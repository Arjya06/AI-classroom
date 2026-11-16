package com.classroom.controller;

import com.classroom.dto.SettingsDtos.*;
import com.classroom.service.SettingsService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService settingsService;

    public SettingsController(SettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    public ResponseEntity<SettingsResponse> get(Authentication auth) {
        return ResponseEntity.ok(settingsService.getSettings(auth.getName()));
    }

    @PutMapping
    public ResponseEntity<SettingsResponse> update(@Valid @RequestBody SettingsRequest req, Authentication auth) {
        return ResponseEntity.ok(settingsService.updateSettings(req, auth.getName()));
    }
}
