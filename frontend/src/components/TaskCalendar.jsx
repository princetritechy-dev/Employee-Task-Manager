import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateKey(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

export default function TaskCalendar({ tasks, onEdit, mode = "employee" }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const tasksByDate = useMemo(() => {
    const map = new Map();
    for (const task of tasks) {
      const key = task.dueDate || task.taskDate;
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(task);
    }
    return map;
  }, [tasks]);

  const { year, month } = cursor;

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = new Date().toISOString().slice(0, 10);

  function shiftMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setCursor({ year: y, month: m });
  }

  return (
    <div className="task-calendar">
      <div className="calendar-head">
        <button className="btn secondary small" onClick={() => shiftMonth(-1)}>
          <ChevronLeft size={14} />
        </button>

        <h3>
          {firstOfMonth.toLocaleString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </h3>

        <button className="btn secondary small" onClick={() => shiftMonth(1)}>
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="calendar-grid calendar-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="calendar-weekday">
            {w}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={i} className="calendar-cell empty" />;
          }

          const key = toDateKey(year, month, day);
          const dayTasks = tasksByDate.get(key) || [];
          const isToday = key === todayKey;

          return (
            <div key={i} className={`calendar-cell ${isToday ? "is-today" : ""}`}>
              <span className="calendar-day-num">{day}</span>

              <div className="calendar-day-tasks">
                {dayTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className={`calendar-task priority-${task.priority || "medium"}`}
                    onClick={() => onEdit?.(task)}
                    title={task.taskTitle}
                  >
                    {mode !== "employee" && task.Employee?.name && (
                      <span className="calendar-task-avatar">
                        {task.Employee.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    {task.taskTitle}
                  </div>
                ))}

                {dayTasks.length > 3 && (
                  <div className="calendar-more">
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
