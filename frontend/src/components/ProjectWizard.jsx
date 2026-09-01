import React, { useState } from "react";
import { Check, Search, X } from "lucide-react";
import AvatarDisplay from "./AvatarDisplay";
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

export default function ProjectWizard({ clients, employees, project, onClose, onCreated }) {
  const isEdit = !!project;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          name: project.name || "",
          clientId: project.clientId || "",
          status: project.status || "ongoing",
          description: project.description || "",
          startDate: project.startDate || "",
          endDate: project.endDate || "",
          employeeIds: (project.Users || []).map((u) => u.id),
        }
      : emptyForm
  );
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

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

  function validate() {
    const errs = {};

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      errs.name = "Project name is required";
    } else if (trimmedName.length > 160) {
      errs.name = "Project name must be 160 characters or fewer";
    }

    setFieldErrors(errs);

    if (errs.name) return { valid: false, step: 1 };
    return { valid: true };
  }

  function goNext() {
    if (step === 1) {
      const result = validate();
      if (!result.valid && result.step === 1) return;
    }
    setStep(step + 1);
  }

  async function save() {
    const result = validate();

    if (!result.valid) {
      setStep(result.step);
      return;
    }

    setError("");
    setSaving(true);

    try {
      if (isEdit) {
        await api.put(`/projects/${project.id}`, form);
      } else {
        await api.post("/projects", form);
      }
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.message || `Could not ${isEdit ? "update" : "create"} project`);
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

        <h2 className="wizard-title">{isEdit ? "Edit Project" : "Create a Project"}</h2>

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
                    className={fieldErrors.name ? "field-invalid" : ""}
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: undefined });
                    }}
                    placeholder="e.g. Acme Website Redesign"
                  />
                  {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
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
                    <AvatarDisplay avatarId={emp.avatarId} name={emp.name} size={32} />
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
                {isEdit
                  ? "Status columns, tags, and more can be fine-tuned from the project page."
                  : "You can fine-tune status columns, tags, and more after the project is created."}
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
              onClick={save}
              disabled={saving}
            >
              {saving
                ? (isEdit ? "Saving..." : "Creating...")
                : (isEdit ? "Save Changes" : "Create Project")}
            </button>

            {step < STEPS.length && (
              <button type="button" className="btn" onClick={goNext}>
                Next step
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}