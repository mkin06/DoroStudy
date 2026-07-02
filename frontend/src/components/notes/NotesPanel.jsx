import React, { useEffect, useState } from 'react';
import { notesAPI } from '../../api/notes';
import { useToast } from '../../contexts/ToastContext';
import './NotesPanel.css';

export default function NotesPanel({ onClose }) {
  const toast = useToast();
  const [notes, setNotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notesAPI.getNotes()
      .then((data) => {
        setNotes(data);
        if (data.length > 0) {
          const firstNote = data[0];
          setActiveId(firstNote.id);
          setEditingId(firstNote.id);
          setTitle(firstNote.title);
          setContent(firstNote.content || '');
        }
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredNotes = notes.filter((note) => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return true;
    const source = `${note.title} ${note.content || ''}`.toLowerCase();
    return source.includes(keyword);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      if (editingId) {
        const updated = await notesAPI.updateNote(editingId, { title, content });
        setNotes(prev => prev.map(n => n.id === editingId ? updated : n));
        setActiveId(updated.id);
        toast.success('Note updated!');
      } else {
        const created = await notesAPI.createNote({ title, content });
        setNotes(prev => [created, ...prev]);
        setEditingId(created.id);
        setActiveId(created.id);
        toast.success('Note created!');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSelectNote = (note) => {
    setActiveId(note.id);
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content || '');
  };

  const handleCreateDraft = () => {
    setActiveId(null);
    setEditingId(null);
    setTitle('Untitled');
    setContent('');
  };

  const handleDelete = async (id) => {
    try {
      await notesAPI.deleteNote(id);
      const remainingNotes = notes.filter(n => n.id !== id);
      setNotes(remainingNotes);

      if (editingId === id || activeId === id) {
        if (remainingNotes.length > 0) {
          const firstNote = remainingNotes[0];
          setEditingId(firstNote.id);
          setActiveId(firstNote.id);
          setTitle(firstNote.title);
          setContent(firstNote.content || '');
        } else {
          setEditingId(null);
          setActiveId(null);
          setTitle('');
          setContent('');
        }
      }

      toast.success('Note deleted!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setActiveId(null);
    setTitle('');
    setContent('');
  };

  return (
    <div className="notes-overlay" onClick={onClose}>
      <div className="notes-panel" onClick={e => e.stopPropagation()}>
        <aside className="notes-sidebar">
          <div className="notes-sidebar-head">
            <h2 className="notes-heading">Notes <span>({filteredNotes.length})</span></h2>
            <button className="notes-new-btn" onClick={handleCreateDraft} title="Create new note">+</button>
          </div>

          <div className="notes-list">
            {loading && <p className="notes-empty">Loading...</p>}
            {!loading && filteredNotes.length === 0 && (
              <p className="notes-empty">No notes found.</p>
            )}
            {filteredNotes.map(note => (
              <button
                key={note.id}
                type="button"
                className={`note-item ${activeId === note.id ? 'active' : ''}`}
                onClick={() => handleSelectNote(note)}
              >
                <p className="note-title">{note.title}</p>
                <p className="note-time">Saved note</p>
                {note.content && <p className="note-content">{note.content}</p>}
              </button>
            ))}
          </div>
        </aside>

        <section className="notes-editor">
          <div className="notes-editor-topbar">
            <input
              className="notes-search"
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <button
              type="button"
              className="notes-delete-top"
              onClick={() => editingId && handleDelete(editingId)}
              disabled={!editingId}
              title="Delete selected note"
            >
              Delete
            </button>
            <button className="notes-close-btn" onClick={onClose}>X</button>
          </div>

          <form className="notes-form" onSubmit={handleSubmit}>
            <div className="notes-toolbar" aria-hidden="true">
              <span>Normal</span>
              <span>B</span>
              <span>I</span>
              <span>U</span>
              <span>List</span>
              <span>Link</span>
            </div>

            <input
              className="notes-title-input"
              type="text"
              placeholder="Untitled"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
            />
            <textarea
              className="notes-content-input"
              placeholder="Write your note..."
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={14}
            />

            <div className="notes-form-actions">
              {(editingId || title || content) && (
                <button type="button" className="notes-cancel-btn" onClick={handleCancel}>
                  Clear
                </button>
              )}
              <button type="submit" className="notes-submit-btn" disabled={!title.trim()}>
                {editingId ? 'Save' : 'Add Note'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
