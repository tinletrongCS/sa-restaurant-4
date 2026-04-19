package com.irms.payment_service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SepayWebhookPayloadDTO {
    private Long id; // SePAY transaction ID
    private String gateway;
    private String transactionDate;
    private String accountNumber;
    private String code;
    private String content; // Nội dung CK
    private String transferType; // in/out
    private Float transferAmount;
    private Float accumulated;
    private String subAccount;
    private String referenceCode;
    private String description;
}
