package org.devnqminh.studyfocus.repository;

import org.devnqminh.studyfocus.model.NoteType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface NoteTypeRepository extends JpaRepository<NoteType, Long> {
    Optional<NoteType> findByName(String name);
}
