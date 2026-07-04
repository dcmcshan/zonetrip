const commitments = [
  {
    kicker: "01",
    title: "Non-direction",
    body: "The system may reflect tensions and questions, but it must not instruct, recommend, rank, or tell organizers what to do.",
  },
  {
    kicker: "02",
    title: "Local containment",
    body: "Raw participant material remains inside the installation by default. The booth must not quietly become a data pipeline.",
  },
  {
    kicker: "03",
    title: "Nightly data burn",
    body: "Raw audio, transient interpretation buffers, caches, and reconstruction-capable material are destroyed at the end of each deployment day.",
  },
  {
    kicker: "04",
    title: "Anti-metric capture",
    body: "No percentages, sentiment scores, dashboards, subgroup comparisons, faction labels, or claims of representativeness.",
  },
  {
    kicker: "05",
    title: "Stewardship over ownership",
    body: "The host cannot own the mirror, alter public reflection, or use the booth as proof that the institution has listened.",
  },
  {
    kicker: "06",
    title: "Right of refusal",
    body: "Zone Trip should not deploy where privacy, consent, deletion, non-direction, or participant comprehension cannot be maintained.",
  },
];

const architectureSteps = [
  ["Participant threshold", "The booth presents a short boundary notice, consent language, and one prompt."],
  ["Local capture", "Audio or text is captured without login, phone pairing, identity collection, or raw external transfer."],
  ["Interpretation", "Local processing forms transient signals without preserving transcript artifacts."],
  ["World model update", "Themes, tensions, contradictions, absences, and minority signals update a derived model without counts or faction maps."],
  ["Nightly burn", "Raw and reconstruction-capable material is deleted through a documented, verifiable protocol."],
  ["Output filter", "Draft reflections are checked for directive language, false authority, metrics, and misuse risk."],
  ["Steward review", "Human stewards inspect draft reflections and constitutional checks without preserving unnecessary content."],
  ["Public reflection", "The final output is framed as a bounded mirror, not a vote, diagnosis, mandate, or recommendation."],
];

const gates = [
  "The community has a plausible need for temporary shared reflection.",
  "The host understands that Zone Trip is non-directive.",
  "The booth can operate locally with controlled network state.",
  "Raw material cannot leave the deployment environment.",
  "Nightly burn and deletion verification are operationally enforceable.",
  "Stewards can withhold output if the reflection would mislead or be misused.",
];

const stopConditions = [
  "The host wants metrics, recommendations, dashboards, raw data access, or evidence for funders.",
  "Participants are unlikely to understand what the system does and does not do.",
  "Speech could expose people to serious harm.",
  "Existing human reflection practices would be displaced rather than supported.",
  "The system cannot enforce deletion or local containment.",
  "The output is likely to become a mandate, proof, faction weapon, or institutional legitimacy device.",
];

const collaborators = [
  "local-first technologists",
  "privacy advisors",
  "constitutional governance thinkers",
  "AI engineers for constrained systems",
  "cultural historians",
  "Burning Man-literate researchers",
  "spatial designers",
  "community stewards",
];

function renderCommitments() {
  const container = document.querySelector("#commitment-list");
  const template = document.querySelector("#card-template");

  for (const commitment of commitments) {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector(".card-kicker").textContent = commitment.kicker;
    card.querySelector("h3").textContent = commitment.title;
    card.querySelector("p:last-child").textContent = commitment.body;
    container.append(card);
  }
}

function renderTimeline() {
  const container = document.querySelector("#architecture-steps");

  for (const [title, body] of architectureSteps) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    label.textContent = title;
    item.append(label, body);
    container.append(item);
  }
}

function renderList(selector, items) {
  const container = document.querySelector(selector);

  for (const text of items) {
    const item = document.createElement("li");
    item.textContent = text;
    container.append(item);
  }
}

function renderCollaborators() {
  const container = document.querySelector("#collaborator-list");

  for (const collaborator of collaborators) {
    const item = document.createElement("span");
    item.textContent = collaborator;
    container.append(item);
  }
}

renderCommitments();
renderTimeline();
renderList("#gate-list", gates);
renderList("#stop-list", stopConditions);
renderCollaborators();
