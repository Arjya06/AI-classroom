package com.classroom.controller;

import com.classroom.dto.StudentDtos.*;
import com.classroom.service.StudentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final StudentService studentService;

    public StudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    @GetMapping
    public ResponseEntity<List<StudentResponse>> list(Authentication auth) {
        return ResponseEntity.ok(studentService.listForTeacher(auth.getName()));
    }

    @PostMapping
    public ResponseEntity<StudentResponse> create(@Valid @RequestBody StudentRequest req, Authentication auth) {
        return ResponseEntity.status(HttpStatus.CREATED).body(studentService.create(req, auth.getName()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StudentResponse> get(@PathVariable Long id, Authentication auth) {
        return ResponseEntity.ok(studentService.getById(id, auth.getName()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<StudentResponse> update(@PathVariable Long id, @Valid @RequestBody StudentRequest req, Authentication auth) {
        return ResponseEntity.ok(studentService.update(id, req, auth.getName()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication auth) {
        studentService.delete(id, auth.getName());
        return ResponseEntity.noContent().build();
    }
}
