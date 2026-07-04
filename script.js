const plans = [
  {
    note: "Balanced for galleries, coffee, transit, and meals.",
    zones: [
      {
        label: "Zone 1",
        name: "Union Station",
        duration: "1h 25m",
        stops: [
          ["09:00", "Coffee and route check"],
          ["09:35", "Bookstore browse"],
          ["10:10", "Light rail transfer"],
        ],
      },
      {
        label: "Zone 2",
        name: "RiNo",
        duration: "2h 05m",
        stops: [
          ["10:30", "Mural walk"],
          ["11:20", "Studio gallery"],
          ["12:05", "Lunch window"],
        ],
      },
      {
        label: "Zone 3",
        name: "Golden Triangle",
        duration: "2h 30m",
        stops: [
          ["13:15", "Museum block"],
          ["14:40", "Civic Center pause"],
          ["15:20", "Dessert stop"],
        ],
      },
      {
        label: "Zone 4",
        name: "South Broadway",
        duration: "1h 10m",
        stops: [
          ["16:20", "Record shop"],
          ["17:00", "Dinner shortlist"],
          ["17:30", "Return plan"],
        ],
      },
    ],
  },
  {
    note: "Shorter hops with more food stops and less museum time.",
    zones: [
      {
        label: "Zone 1",
        name: "LoDo",
        duration: "1h 10m",
        stops: [
          ["10:00", "Brunch"],
          ["10:45", "Market walk"],
        ],
      },
      {
        label: "Zone 2",
        name: "Highland",
        duration: "2h 15m",
        stops: [
          ["11:30", "Bridge crossing"],
          ["12:05", "Patio lunch"],
          ["13:00", "Design shops"],
        ],
      },
      {
        label: "Zone 3",
        name: "Capitol Hill",
        duration: "1h 55m",
        stops: [
          ["14:00", "Historic walk"],
          ["14:50", "Cafe reset"],
          ["15:30", "Transit home"],
        ],
      },
    ],
  },
];

const zoneList = document.querySelector("#zone-list");
const zoneTemplate = document.querySelector("#zone-template");
const planNote = document.querySelector("#plan-note");
const zoneCount = document.querySelector("#zone-count");
const stopCount = document.querySelector("#stop-count");
const totalTime = document.querySelector("#total-time");
const shuffleButton = document.querySelector("#shuffle-plan");

let currentPlan = 0;

function minutesFromDuration(duration) {
  const hours = Number(duration.match(/(\d+)h/)?.[1] ?? 0);
  const minutes = Number(duration.match(/(\d+)m/)?.[1] ?? 0);
  return hours * 60 + minutes;
}

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function renderPlan(plan) {
  zoneList.replaceChildren();
  planNote.textContent = plan.note;
  zoneCount.textContent = String(plan.zones.length);

  const stops = plan.zones.flatMap((zone) => zone.stops);
  stopCount.textContent = String(stops.length);
  totalTime.textContent = formatMinutes(
    plan.zones.reduce((sum, zone) => sum + minutesFromDuration(zone.duration), 0),
  );

  for (const zone of plan.zones) {
    const card = zoneTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector(".zone-card__label").textContent = zone.label;
    card.querySelector("h3").textContent = zone.name;
    card.querySelector(".zone-card__time").textContent = zone.duration;

    const list = card.querySelector("ul");
    for (const [time, title] of zone.stops) {
      const item = document.createElement("li");
      item.innerHTML = `<span class="stop-time">${time}</span><strong>${title}</strong>`;
      list.append(item);
    }

    zoneList.append(card);
  }
}

shuffleButton.addEventListener("click", () => {
  currentPlan = (currentPlan + 1) % plans.length;
  renderPlan(plans[currentPlan]);
});

renderPlan(plans[currentPlan]);
