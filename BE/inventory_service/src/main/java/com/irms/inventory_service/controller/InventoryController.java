package com.irms.inventory_service.controller;

import com.irms.inventory_service.dto.InventoryItemRequestDTO;
import com.irms.inventory_service.dto.InventoryItemResponseDTO;
import com.irms.inventory_service.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
//@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    // PUBLIC: Menu cho khách hàng 
    @GetMapping("/menu")
    public ResponseEntity<List<InventoryItemResponseDTO>> getMenu() {
        return ResponseEntity.ok(inventoryService.getMenu());
    }

    @GetMapping("/menu/{category}")
    public ResponseEntity<List<InventoryItemResponseDTO>> getMenuByCategory(@PathVariable String category) {
        return ResponseEntity.ok(inventoryService.getMenuByCategory(category));
    }

    @GetMapping("/items/{id}")
    public ResponseEntity<InventoryItemResponseDTO> getItemById(@PathVariable Long id) {
        return ResponseEntity.ok(inventoryService.getItemById(id));
    }

    // ADMIN: Quản lý inventory 
    @GetMapping("/items")
    public ResponseEntity<List<InventoryItemResponseDTO>> getAllItems() {
        return ResponseEntity.ok(inventoryService.getAllItems());
    }

    @PostMapping("/items")
    public ResponseEntity<List<InventoryItemResponseDTO>> createItems(@RequestBody List<InventoryItemRequestDTO> dtos) {
        return ResponseEntity.status(HttpStatus.CREATED).body(inventoryService.createItems(dtos));
    }

    @PutMapping("/items/{id}")
    public ResponseEntity<InventoryItemResponseDTO> updateItem(@PathVariable Long id,
                                                               @RequestBody InventoryItemRequestDTO dto) {
        return ResponseEntity.ok(inventoryService.updateItem(id, dto));
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<Void> deleteItem(@PathVariable Long id) {
        inventoryService.deleteItem(id);
        return ResponseEntity.noContent().build();
    }

    // INTERNAL: Gọi từ ordering-service 

    /**
     * PATCH /api/inventory/items/{id}/quantity?delta=-1
     * Cập nhật số lượng món (ordering-service gọi khi khách đặt món).
     * delta âm = giảm số lượng, delta dương = nhập thêm hàng.
     */
    @PatchMapping("/items/{id}/quantity")
    public ResponseEntity<InventoryItemResponseDTO> updateQuantity(@PathVariable Long id,
                                                                    @RequestParam int delta) {
        return ResponseEntity.ok(inventoryService.updateQuantity(id, delta));
    }
}
