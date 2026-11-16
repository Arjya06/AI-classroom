package com.classroom.controller;

import com.classroom.dto.ClassroomDtos.*;
import com.classroom.service.ClassroomService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/classrooms")
public class ClassroomController {

    private final ClassroomService classroomService;

    public ClassroomController(ClassroomService classroomService) {
        this.classroomService = classroomService;
    }

    @GetMapping
    public ResponseEntity<List<ClassroomResponse>> list(Authentication auth) {
        return ResponseEntity.ok(classroomService.listForTeacher(auth.getName()));
    }

    @PostMapping
    public ResponseEntity<ClassroomResponse> create(@Valid @RequestBody ClassroomRequest req, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(classroomService.create(req, auth.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ClassroomResponse> get(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(classroomService.getById(id, auth.getName()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ClassroomResponse> update(@PathVariable Long id, @Valid @RequestBody ClassroomRequest req, Authentication auth) {
        return ResponseEntity.ok(classroomService.update(id, req, auth.getName()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication auth) {
        classroomService.delete(id, auth.getName());
        return ResponseEntity.noContent().build();
    }
}
