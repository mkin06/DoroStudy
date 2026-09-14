package org.devnqminh.studyfocus.service.Impl;

import lombok.RequiredArgsConstructor;
import org.devnqminh.studyfocus.dto.request.NoteRequest;
import org.devnqminh.studyfocus.dto.response.NoteResponse;
import org.devnqminh.studyfocus.model.Note;
import org.devnqminh.studyfocus.model.NoteType;
import org.devnqminh.studyfocus.model.User;
import org.devnqminh.studyfocus.repository.NoteRepository;
import org.devnqminh.studyfocus.repository.NoteTypeRepository;
import org.devnqminh.studyfocus.repository.UserRepository;
import org.devnqminh.studyfocus.service.INoteService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NoteServiceImpl implements INoteService {

    private final NoteRepository noteRepository;
    private final NoteTypeRepository noteTypeRepository;
    private final UserRepository userRepository;

    @Override
    public List<NoteResponse> getNotes(Long userId) {
        return noteRepository.findByUser_Id(userId).stream()
                .map(n -> new NoteResponse(n.getId(), n.getTitle(), n.getContent()))
                .toList();
    }

    @Override
    public NoteResponse createNote(NoteRequest request, Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        NoteType type = noteTypeRepository.findByName("General")
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Default note type not found"));

        Note note = Note.builder()
                .title(request.title())
                .content(request.content())
                .user(user)
                .type(type)
                .build();

        Note saved = noteRepository.save(note);
        return new NoteResponse(saved.getId(), saved.getTitle(), saved.getContent());
    }

    @Override
    public NoteResponse updateNote(Long id, NoteRequest request, Long userId) {
        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found"));

        if (!note.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        note.setTitle(request.title());
        note.setContent(request.content());

        Note saved = noteRepository.save(note);
        return new NoteResponse(saved.getId(), saved.getTitle(), saved.getContent());
    }

    @Override
    public void deleteNote(Long id, Long userId) {
        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Note not found"));

        if (!note.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        noteRepository.delete(note);
    }
}
