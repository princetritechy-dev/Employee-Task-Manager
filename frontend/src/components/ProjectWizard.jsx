import React, { useState } from "react";
import { Check, Search, X } from "lucide-react";
import api from "../api";

const STEPS = [
  { n: 1, label: "Details" },
  { n: 2, label: "Add People" },
  { n: 3, label: "Advanced Options" },
];

const emptyForm = {
  name: "",
  clientId: "",
  status: "ongoing",
  description: "",
  startDate: "",
  endDate: "",
  employeeIds: [],
};

export default function ProjectWizard({ clients, employees, onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canCreate = form.name.trim().length > 0;

  const filteredEmployees = employees.filter((e) =>
    `${e.name} ${e.email}`.toLowerCase().includes(search.toLowerCase())
  );

  function toggleId(field, id) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(id)
        ? f[field].filter((x) => x !== id)
        : [...f[field], id],
    }));
  }

  async function create() {
    if (!canCreate) {
      setError("Project name is required");
      setStep(1);
      return;
    }

    setError("");
    setSaving(true);

    try {
      await api.post("/projects", form);
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.message || "Could not create project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="wizard-modal" onClick={(e) => e.stopPropagation()}>

        <button className="close-btn wizard-close" onClick={onClose}>
          <X size={16} />
        </button>

        <h2 className="wizard-title">Create a Project</h2>

        <div className="wizard-stepper">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <div className="wizard-step-node">
                <button
                  type="button"
                  className={`wizard-step-circle ${
                    step === s.n ? "current" : step > s.n ? "done" : ""
                  }`}
                  onClick={() => setStep(s.n)}
                >
                  {step > s.n ? <Check size={14} /> : s.n}
                </button>
                <span className="wizard-step-label">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`wizard-step-line ${step > s.n ? "done" : ""}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {error && <div className="error">{error}</div>}

        <div className="wizard-body">

          {step === 1 && (
            <>
              <div className="grid two">
                <div>
                  <label>Project name *</label>
                  <input
                    autoFocus
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Acme Website Redesign"
                  />
                </div>
                <div>
                  <label>Client / Company</label>
                  <select
                    value={form.clientId}
                    onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                  >
                    <option value="">No client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <label>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="ongoing">ongoing</option>
                <option value="paused">paused</option>
                <option value="completed">completed</option>
              </select>

              <label>Project description</label>
              <textarea
                rows="4"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Add a description"
              />
            </>
          )}

          {step === 2 && (
            <>
              <div className="wizard-search">
                <Search size={15} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employees..."
                />
              </div>

              <div className="wizard-people-list">
                {filteredEmployees.map((emp) => (
                  <div className="wizard-people-row" key={emp.id}>
                    <span className="mini-avatar">
                      {emp.name?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                    <div className="wizard-people-info">
                      <strong>{emp.name}</strong>
                      <small>{emp.email}</small>
                    </div>
                    <label className="wizard-people-check">
                      <input
                        type="checkbox"
                        checked={form.employeeIds.includes(emp.id)}
                        onChange={() => toggleId("employeeIds", emp.id)}
                      />
                      Member
                    </label>
                  </div>
                ))}

                {!filteredEmployees.length && (
                  <p className="muted" style={{ padding: "12px" }}>
                    No employees match "{search}".
                  </p>
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="grid two">
                <div>
                  <label>Start date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <label>End date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </div>
              </div>

              <p className="muted small-note">
                You can fine-tune status columns, tags, and more after the project is created.
              </p>
            </>
          )}

        </div>

        <div className="wizard-footer">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>

          <div className="wizard-footer-right">
            {step > 1 && (
              <button type="button" className="btn secondary" onClick={() => setStep(step - 1)}>
                Previous step
              </button>
            )}

            <button
              type="button"
              className="btn secondary"
              onClick={create}
              disabled={!canCreate || saving}
            >
              {saving ? "Creating..." : "Create Project"}
            </button>

            {step < STEPS.length && (
              <button type="button" className="btn" onClick={() => setStep(step + 1)}>
                Next step
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
