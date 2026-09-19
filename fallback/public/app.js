async function submitIncident(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("incident-status");
  const data = new FormData(form);
  const body = new URLSearchParams(data);
  const response = await fetch("/api/incidents", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  status.textContent = await response.text();
}

async function submitReport(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById("report-status");
  const data = new FormData(form);
  let config;
  let compatPatch;

  try {
    config = JSON.parse(String(data.get("config") || "{}"));
    compatPatch = JSON.parse(String(data.get("compatPatch") || "{}"));
  } catch {
    status.textContent = "Invalid settings format. Check the view fields.";
    return;
  }

  const payload = {
    name: data.get("name"),
    config,
    compatPatch
  };
  const response = await fetch("/api/admin/report-profiles/import", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  status.textContent = await response.text();
}

document.getElementById("incident-form")?.addEventListener("submit", submitIncident);
document.getElementById("report-form")?.addEventListener("submit", submitReport);
