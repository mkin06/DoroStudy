package org.devnqminh.studyfocus.service;

import org.devnqminh.studyfocus.dto.request.NoteRequest;
import org.devnqminh.studyfocus.dto.response.NoteResponse;

import java.util.List;

public interface INoteService {
    List<NoteResponse> getNotes(Long userId);
    NoteResponse createNote(NoteRequest request, Long userId);
    NoteResponse updateNote(Long id, NoteRequest request, Long userId);
    void deleteNote(Long id, Long userId);
}
