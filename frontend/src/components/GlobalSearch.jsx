import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, CheckSquare, FolderKanban, Building2, User as UserIcon } from "lucide-react";
import api from "../api";

let debounceTimer = null;

export default function GlobalSearch({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ tasks: [], projects: [], clients: [], users: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults({ tasks: [], projects: [], clients: [], users: [] });
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    clearTimeout(debounceTimer);

    if (!query.trim()) {
      setResults({ tasks: [], projects: [], clients: [], users: [] });
      return;
    }

    debounceTimer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.get("/search", { params: { q: query.trim() } });
        setResults(r.data || { tasks: [], projects: [], clients: [], users: [] });
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(debounceTimer);
  }, [query]);

  function go(path) {
    onClose();
    navigate(path);
  }

  if (!open) return null;

  const hasResults =
    results.tasks.length || results.projects.length || results.clients.length || results.users.length;

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-palette" onClick={(e) => e.stopPropagation()}>

        <div className="search-palette-input-row">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, projects, clients..."
          />
          <button className="close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="search-palette-body">
          {!query.trim() && (
            <p className="muted" style={{ padding: "16px" }}>
              Start typing to search across tasks, projects, and clients.
            </p>
          )}

          {query.trim() && !loading && !hasResults && (
            <p className="muted" style={{ padding: "16px" }}>
              No results for "{query}".
            </p>
          )}

          {results.tasks.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Tasks</div>
              {results.tasks.map((t) => (
                <div
                  key={t.id}
                  className="search-result-row"
                  onClick={() => go(`/projects/${t.projectId}`)}
                >
                  <CheckSquare size={14} />
                  <span>{t.title}</span>
                </div>
              ))}
            </div>
          )}

          {results.projects.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Projects</div>
              {results.projects.map((p) => (
                <div
                  key={p.id}
                  className="search-result-row"
                  onClick={() => go(`/projects/${p.id}`)}
                >
                  <FolderKanban size={14} />
                  <span>{p.name}</span>
                </div>
              ))}
            </div>
          )}

          {results.clients.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Clients</div>
              {results.clients.map((c) => (
                <div
                  key={c.id}
                  className="search-result-row"
                  onClick={() => go("/clients")}
                >
                  <Building2 size={14} />
                  <span>{c.name}</span>
                </div>
              ))}
            </div>
          )}

          {results.users.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Users</div>
              {results.users.map((u) => (
                <div
                  key={u.id}
                  className="search-result-row"
                  onClick={() => go("/admin/users")}
                >
                  <UserIcon size={14} />
                  <span>{u.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
