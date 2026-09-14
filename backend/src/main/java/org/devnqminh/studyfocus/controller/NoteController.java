package org.devnqminh.studyfocus.controller;

import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.dto.request.NoteRequest;
import org.devnqminh.studyfocus.dto.response.NoteResponse;
import org.devnqminh.studyfocus.service.INoteService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
public class NoteController {

    private final INoteService noteService;

    private Long requireUserId(HttpSession session) {
        Long userId = (Long) session.getAttribute("USER_ID");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthenticated");
        }
        return userId;
    }

    @GetMapping
    public List<NoteResponse> getNotes(HttpSession session) {
        return noteService.getNotes(requireUserId(session));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NoteResponse createNote(@Valid @RequestBody NoteRequest request, HttpSession session) {
        return noteService.createNote(request, requireUserId(session));
    }

    @PutMapping("/{id}")
    public NoteResponse updateNote(@PathVariable Long id, @Valid @RequestBody NoteRequest request, HttpSession session) {
        return noteService.updateNote(id, request, requireUserId(session));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteNote(@PathVariable Long id, HttpSession session) {
        noteService.deleteNote(id, requireUserId(session));
    }
}
