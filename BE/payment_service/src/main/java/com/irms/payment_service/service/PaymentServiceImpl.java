package com.irms.payment_service.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.irms.payment_service.dto.InvoiceResponseDTO;
import com.irms.payment_service.dto.OrderResponseDTO;
import com.irms.payment_service.dto.SepayWebhookPayloadDTO;
import com.irms.payment_service.dto.TaxConfigDTO;
import com.irms.payment_service.entity.PaymentRecordEntity;
import com.irms.payment_service.entity.TaxConfigEntity;
import com.irms.payment_service.entity.TransactionLogEntity;
import com.irms.payment_service.repository.PaymentRecordRepository;
import com.irms.payment_service.repository.TaxConfigRepository;
import com.irms.payment_service.repository.TransactionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {
    private static final Logger log = LoggerFactory.getLogger(PaymentServiceImpl.class);

    private final TaxConfigRepository taxConfigRepository;
    private final PaymentRecordRepository paymentRecordRepository;
    private final TransactionLogRepository transactionLogRepository;
    private final RestTemplate restTemplate;

    private final ObjectMapper objectMapper;

    @Value("${ordering.service.url}")
    private String orderingServiceUrl;

    @Value("${sepay.bank.account-number}")
    private String bankAccountNumber;

    @Value("${sepay.bank.bank-name}")
    private String bankName;

    // url image
    @Value("${sepay.bank.qr-base-url}")
    private String qrBaseUrl;

    @Value("${payment.default-tax-rate}")
    private BigDecimal defaultTaxRate;

    @Override
    public InvoiceResponseDTO createInvoice(Long orderId) {
        log.info("Creating invoice for order: {}", orderId);
        String getOrderUrl = orderingServiceUrl + "/" + orderId;
        log.debug("Fetching order from: {}", getOrderUrl);
        OrderResponseDTO order = restTemplate.getForObject(getOrderUrl, OrderResponseDTO.class);
        if (order == null) {
            log.error("Order not found: {}", orderId);
            throw new RuntimeException("Order not found");
        }

        // 2. Get current tax config
        TaxConfigDTO currentTax = getCurrentTaxConfig();
        BigDecimal taxRate = currentTax.getTaxRate();

        Float totalPrice = order.getTotalPrice() != null ? order.getTotalPrice() : 0f;
        Float taxAmount = totalPrice * taxRate.floatValue() / 100f;
        Float finalPrice = totalPrice + taxAmount;

        log.debug("Updating final price to: {} for order: {}", finalPrice, orderId);
        URI updatePriceUri = UriComponentsBuilder.fromUriString(orderingServiceUrl)
                .path("/{id}/final-price")
                .queryParam("value", finalPrice)
                .buildAndExpand(orderId)
                .toUri();
        restTemplate.put(updatePriceUri, null);
        log.debug("Successfully updated final price in ordering-service");

        // 5. Save payment record
        // -> need refactor
        PaymentRecordEntity record = paymentRecordRepository.findByOrderId(orderId)
                .orElse(new PaymentRecordEntity());
        record.setOrderId(orderId);
        record.setTotalPrice(totalPrice);
        record.setTaxRate(taxRate);
        record.setTaxAmount(taxAmount);
        record.setFinalPrice(finalPrice);
        record.setStatus("WAITING");
        if (record.getId() == null) {
            record.setCreatedAt(LocalDateTime.now());
        }
        paymentRecordRepository.save(record);
        log.debug("Saved payment record for order: {}", orderId);

        String description = "SEVQR Thanh toan DH" + orderId;
        String qrUrl = UriComponentsBuilder.fromUriString(qrBaseUrl)
                .queryParam("acc", bankAccountNumber)
                .queryParam("bank", bankName)
                .queryParam("amount", Math.round(finalPrice))
                .queryParam("des", description)
                .build()
                .encode()
                .toUriString();
        
        log.info("Generated QR URL for order {}: {}", orderId, qrUrl);

        return new InvoiceResponseDTO(
                orderId,
                order.getTableId(),
                order.getUserName(),
                totalPrice,
                taxRate,
                taxAmount,
                finalPrice,
                qrUrl,
                order.getItems()
        );
    }

    @Override
    public TaxConfigDTO getCurrentTaxConfig() {
        List<TaxConfigEntity> configs = taxConfigRepository.findAll();
        if (configs.isEmpty()) {
            TaxConfigEntity defaultConfig = new TaxConfigEntity();
            defaultConfig.setTaxRate(defaultTaxRate);
            defaultConfig.setEffectiveDate(LocalDateTime.now());
            defaultConfig.setModifiedBy("system");
            defaultConfig.setModifiedAt(LocalDateTime.now());
            defaultConfig.setNote("Default tax rate");
            taxConfigRepository.save(defaultConfig);
            return toDTO(defaultConfig);
        }
        // Return latest (simplification, assuming single record or latest ID)
        TaxConfigEntity latest = configs.get(configs.size() - 1);
        return toDTO(latest);
    }

    @Override
    public TaxConfigDTO updateTaxConfig(BigDecimal taxRate, String note, String modifiedBy) {
        TaxConfigEntity current = null;
        List<TaxConfigEntity> configs = taxConfigRepository.findAll();
        if (!configs.isEmpty()) {
            current = configs.get(configs.size() - 1);
        }

        BigDecimal prevRate = current != null ? current.getTaxRate() : defaultTaxRate;

        TaxConfigEntity newConfig = new TaxConfigEntity();
        newConfig.setTaxRate(taxRate);
        newConfig.setPreviousRate(prevRate);
        newConfig.setNote(note);
        newConfig.setModifiedBy(modifiedBy);
        newConfig.setModifiedAt(LocalDateTime.now());
        newConfig.setEffectiveDate(LocalDateTime.now());

        taxConfigRepository.save(newConfig);
        return toDTO(newConfig);
    }

    @Override
    public void processWebhook(SepayWebhookPayloadDTO payload) {
        // 1. Idempotency check
        Optional<TransactionLogEntity> existingLog = transactionLogRepository.findBySepayTransactionId(payload.getId());
        if (existingLog.isPresent()) {
            return; // Already processed
        }

        // 2. Initial Logging
        TransactionLogEntity logEntity = new TransactionLogEntity();
        logEntity.setSepayTransactionId(payload.getId());
        logEntity.setGateway(payload.getGateway());
        logEntity.setTransactionDate(payload.getTransactionDate());
        logEntity.setAccountNumber(payload.getAccountNumber());
        logEntity.setAmountIn(payload.getTransferAmount()); // Assuming transferType="in" is handled below
        if ("out".equals(payload.getTransferType())) {
             logEntity.setAmountIn(0f);
             logEntity.setAmountOut(payload.getTransferAmount());
        } else {
             logEntity.setAmountIn(payload.getTransferAmount());
             logEntity.setAmountOut(0f);
        }
        logEntity.setContent(payload.getContent());
        logEntity.setReferenceCode(payload.getReferenceCode());
        try {
            logEntity.setRawBody(objectMapper.writeValueAsString(payload));
        } catch (Exception e) {
            logEntity.setRawBody(payload.toString());
        }
        logEntity.setReceivedAt(LocalDateTime.now());

        // 3. Process if incoming standard payment
        if ("in".equalsIgnoreCase(payload.getTransferType())) {
            Long orderId = extractOrderId(payload.getContent());
            if (orderId != null) {
                logEntity.setOrderId(orderId);
                Optional<PaymentRecordEntity> recordOpt = paymentRecordRepository.findByOrderId(orderId);
                if (recordOpt.isPresent()) {
                    PaymentRecordEntity record = recordOpt.get();
                    if (payload.getTransferAmount() >= (record.getFinalPrice() - 100)) { // Flexible 100 VND
                        try {
                            URI updateStatusUri = UriComponentsBuilder.fromUriString(orderingServiceUrl)
                                .path("/{id}/status")
                                .queryParam("value", "COMPLETED")
                                .buildAndExpand(orderId)
                                .toUri();
                            restTemplate.put(updateStatusUri, null);

                            record.setStatus("PAID");
                            record.setPaidAt(LocalDateTime.now());
                            paymentRecordRepository.save(record);
                        } catch(Exception e) {
                             System.err.println("Error updating order status: " + e.getMessage());
                        }
                    } else {
                        record.setStatus("FAILED");
                        paymentRecordRepository.save(record);
                        System.out.println("Payment amount missing: Received " + payload.getTransferAmount() + " Expected " + record.getFinalPrice());
                    }
                }
            }
        }
        transactionLogRepository.save(logEntity);
    }

    @Override
    public List<TransactionLogEntity> getAllTransactions() {
        return transactionLogRepository.findAll();
    }

    @Override
    public List<TransactionLogEntity> getTransactionsByOrderId(Long orderId) {
        return transactionLogRepository.findAll().stream()
                .filter(log -> orderId.equals(log.getOrderId()))
                .toList();
    }

    private Long extractOrderId(String content) {
        if (content == null) return null;
        Pattern pattern = Pattern.compile("DH(\\d+)");
        Matcher matcher = pattern.matcher(content);
        if (matcher.find()) {
            try {
                return Long.parseLong(matcher.group(1));
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private TaxConfigDTO toDTO(TaxConfigEntity entity) {
        return new TaxConfigDTO(
                entity.getId(),
                entity.getTaxRate(),
                entity.getEffectiveDate(),
                entity.getModifiedBy(),
                entity.getModifiedAt(),
                entity.getPreviousRate(),
                entity.getNote()
        );
    }
}
