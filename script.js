// Global State
let scheduleData = [];
let filteredData = [];
let selectedDay = "Senin";
let filterType = "day";
let filterValue = "";
let colorBy = "time";

// Builder State
let maxSKS = 24;
let classType = "Normal";
let avoidDays = [];
let avoidLecturers = [];
let selectedCourses = [];
let excludedCourses = [];
let transcriptExcludedCourses = [];
let allCourses = [];
let courseSKSMap = {};
let generatedSchedules = [];
let currentScheduleIndex = 0;
let daySearchTerm = "";
let passedCoursesWithGrade = [];

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    lucide.createIcons();
  }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  loadScheduleData();
  setupEventListeners();
  refreshIcons();
  setupTranscriptListeners();
});

// Load CSV Data
async function loadScheduleData() {
  try {
    const response = await fetch("schedule-data.csv");
    const csv = await response.text();
    // Filter out kelas RPL dan RKA agar tidak muncul di view maupun builder
    scheduleData = parseCSV(csv).filter((entry) => {
      const kelas = (entry.kelas || "").toUpperCase();
      return !kelas.includes("RPL") && !kelas.includes("RKA");
    });
    allCourses = [...new Set(scheduleData.map((e) => e.mataKuliah))].sort();
    courseSKSMap = buildCourseSKSMap(scheduleData);
    filteredData = [...scheduleData];
    updateUI();
    populateLecturerSelect();
    renderCourseSelector();
    showToast("Data loaded successfully!", "success");
  } catch (error) {
    showToast("Failed to load schedule data", "error");
  }
}

function buildCourseSKSMap(data) {
  const map = {};
  data.forEach((entry) => {
    if (!map[entry.mataKuliah]) {
      map[entry.mataKuliah] = entry.sks;
    }
  });
  return map;
}

// Parse CSV
function parseCSV(csv) {
  const lines = csv.trim().split("\n");
  const headers = lines[0].split(",");

  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return {
      hari: values[0],
      jam: values[1],
      mataKuliah: values[2],
      kelas: values[3],
      sks: parseInt(values[4]),
      semester: parseInt(values[5]),
      dosen: values[6],
      ruangan: values[7],
    };
  });
}

// Event Listeners
function setupEventListeners() {
  // Main tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".tab-btn")
        .forEach((b) => b.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));
      e.target.classList.add("active");
      document
        .getElementById(`${e.target.dataset.tab}-tab`)
        .classList.add("active");
    });
  });

  // Filter type buttons
  document.querySelectorAll(".filter-type-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".filter-type-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      filterType = e.target.dataset.type;
      updateFilterOptions();
    });
  });

  // Filter select
  document.getElementById("filter-select").addEventListener("change", (e) => {
    filterValue = e.target.value;
    applyFilter();
    document.getElementById("clear-filter").style.display = filterValue
      ? "block"
      : "none";
  });

  // Day search (per hari)
  const daySearchInput = document.getElementById("day-search");
  if (daySearchInput) {
    daySearchInput.addEventListener("input", (e) => {
      daySearchTerm = e.target.value;
      renderScheduleCards();
    });
  }

  // Clear filter
  document.getElementById("clear-filter").addEventListener("click", () => {
    filterValue = "";
    document.getElementById("filter-select").value = "";
    document.getElementById("clear-filter").style.display = "none";
    applyFilter();
  });

  // Color toggle
  document.querySelectorAll(".toggle-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".toggle-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      colorBy = e.target.dataset.color;
      renderScheduleCards();
    });
  });

  // Day tabs
  document.querySelectorAll(".day-tab").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".day-tab")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      selectedDay = e.target.dataset.day;
      renderScheduleCards();
    });
  });

  // Builder: Class type
  document.querySelectorAll(".class-type-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".class-type-btn")
        .forEach((b) => b.classList.remove("active"));
      e.target.classList.add("active");
      classType = e.target.dataset.type;
    });
  });

  // Builder: Max SKS
  document.getElementById("max-sks").addEventListener("input", (e) => {
    maxSKS = parseInt(e.target.value);
  });

  // Builder: Avoid days
  document.getElementById("add-avoid-day").addEventListener("click", () => {
    const select = document.getElementById("avoid-day-select");
    const day = select.value;
    if (day && !avoidDays.includes(day)) {
      avoidDays.push(day);
      updateAvoidDaysList();
    }
    select.value = "";
  });

  // Builder: Avoid lecturers
  document
    .getElementById("add-avoid-lecturer")
    .addEventListener("click", () => {
      const select = document.getElementById("avoid-lecturer-select");
      const lecturer = select.value;
      if (lecturer && !avoidLecturers.includes(lecturer)) {
        avoidLecturers.push(lecturer);
        updateAvoidLecturersList();
      }
      select.value = "";
    });

  // Course search
  const courseSearchInput = document.getElementById("course-search");
  if (courseSearchInput) {
    courseSearchInput.addEventListener("input", (e) => {
      renderCourseSelector(e.target.value);
    });
  }

  // Semester filter (Step 2)
  const semesterFilter = document.getElementById("semester-filter");
  if (semesterFilter) {
    semesterFilter.addEventListener("change", () => {
      renderCourseSelector(
        document.getElementById("course-search")
          ? document.getElementById("course-search").value
          : ""
      );
    });
  }

  // Schedule navigation
  document.getElementById("prev-schedule").addEventListener("click", () => {
    if (currentScheduleIndex > 0) {
      currentScheduleIndex--;
      renderGeneratedSchedule();
    }
  });

  document.getElementById("next-schedule").addEventListener("click", () => {
    if (currentScheduleIndex < generatedSchedules.length - 1) {
      currentScheduleIndex++;
      renderGeneratedSchedule();
    }
  });
}

// Update UI
function updateUI() {
  updateStatistics();
  updateFilterOptions();
  populateSemesterFilter();
  renderScheduleCards();
}

// Update Statistics
function updateStatistics() {
  const uniqueCourses = new Set(scheduleData.map((e) => e.mataKuliah)).size;
  const uniqueLecturers = new Set(
    scheduleData.map((e) => e.dosen).filter((d) => d && d !== "-")
  ).size;
  const uniqueRooms = new Set(
    scheduleData.map((e) => e.ruangan).filter((r) => r && r !== "-")
  ).size;

  document.getElementById("total-schedules").textContent = scheduleData.length;
  document.getElementById("total-courses").textContent = uniqueCourses;
  document.getElementById("total-lecturers").textContent = uniqueLecturers;
  document.getElementById("total-rooms").textContent = uniqueRooms;
}

// Update Filter Options
function updateFilterOptions() {
  const select = document.getElementById("filter-select");
  select.innerHTML = '<option value="">Choose a filter</option>';

  let options = [];
  switch (filterType) {
    // case "day":
    //   options = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
    //   break;
    case "room":
      options = [
        ...new Set(
          scheduleData.map((e) => e.ruangan).filter((r) => r && r !== "-")
        ),
      ].sort();
      break;
    case "lecturer":
      options = [
        ...new Set(
          scheduleData.map((e) => e.dosen).filter((d) => d && d !== "-")
        ),
      ].sort();
      break;
    case "semester":
      options = [...new Set(scheduleData.map((e) => e.semester))].sort(
        (a, b) => a - b
      );
      break;
  }

  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = opt;
    select.appendChild(option);
  });
}

// Apply Filter
function applyFilter() {
  if (!filterValue) {
    filteredData = [...scheduleData];
  } else {
    filteredData = scheduleData.filter((entry) => {
      switch (filterType) {
        case "day":
          return entry.hari === filterValue;
        case "room":
          return entry.ruangan === filterValue;
        case "lecturer":
          return entry.dosen === filterValue;
        case "semester":
          return entry.semester === parseInt(filterValue);
        default:
          return true;
      }
    });
  }
  renderScheduleCards();
}

// Render Schedule Cards
function renderScheduleCards() {
  const container = document.getElementById("schedule-cards");
  const normalizedSearch = daySearchTerm.trim().toLowerCase();
  const dayEntries = filteredData
    .filter((e) => e.hari === selectedDay)
    .filter((e) =>
      normalizedSearch
        ? e.mataKuliah.toLowerCase().includes(normalizedSearch)
        : true
    )
    .sort((a, b) => a.jam.localeCompare(b.jam));

  if (dayEntries.length === 0) {
    container.innerHTML =
      '<div class="empty-state"><p>No schedule for this day</p></div>';
    return;
  }

  container.innerHTML = dayEntries
    .map((entry) => createScheduleCard(entry))
    .join("");
  refreshIcons();
}

// Create Schedule Card
function createScheduleCard(entry) {
  const colorClass =
    colorBy === "time"
      ? getTimeCategory(entry.jam)
      : `semester-${entry.semester}`;

  return `
    <div class="schedule-card ${colorClass}">
        <div class="card-top">
            <div>
                <div class="card-title">${entry.mataKuliah}</div>
                <div class="card-subtitle">${entry.hari} &bull; Semester ${entry.semester} &bull; ${entry.sks} SKS</div>
            </div>
            <span class="chip chip-primary">${entry.kelas}</span>
        </div>
        <div class="card-info">
            <div class="info-row">
                <i data-lucide="clock-3" class="info-icon"></i>
                <span>${entry.jam}</span>
            </div>
            <div class="info-row">
                <i data-lucide="map-pin" class="info-icon"></i>
                <span>${entry.ruangan}</span>
            </div>
            <div class="info-row">
                <i data-lucide="user-round" class="info-icon"></i>
                <span>${entry.dosen}</span>
            </div>
            <div class="info-row">
                <i data-lucide="layers" class="info-icon"></i>
                <span>Semester ${entry.semester} &bull; ${entry.sks} SKS</span>
            </div>
        </div>
    </div>
`;
}


// Get Time Category
function getTimeCategory(jam) {
  const hour = parseInt(jam.split(".")[0]);
  if (hour < 12) return "morning";
  if (hour < 16) return "afternoon";
  return "evening";
}

// Builder Functions
function populateLecturerSelect() {
  const select = document.getElementById("avoid-lecturer-select");
  const lecturers = [
    ...new Set(scheduleData.map((e) => e.dosen).filter((d) => d && d !== "-")),
  ].sort();

  lecturers.forEach((lecturer) => {
    const option = document.createElement("option");
    option.value = lecturer;
    option.textContent = lecturer;
    select.appendChild(option);
  });
}

function populateSemesterFilter() {
  const select = document.getElementById("semester-filter");
  if (!select) return;
  const semesters = [...new Set(scheduleData.map((e) => e.semester))].sort(
    (a, b) => a - b
  );
  select.innerHTML = '<option value="">All semesters</option>';
  semesters.forEach((sem) => {
    const option = document.createElement("option");
    option.value = sem;
    option.textContent = `Semester ${sem}`;
    select.appendChild(option);
  });
}

function renderCourseSelector(searchTerm = "") {
  const container = document.getElementById("course-selector");
  const normalizedTerm = searchTerm.trim().toLowerCase();
  const semesterFilter = document.getElementById("semester-filter");
  const selectedSemester = semesterFilter ? semesterFilter.value : "";

  // Filter Logic
  const courses = allCourses.filter((course) => {
    // 1. Check if course is in the Excluded list (Passed courses)
    if (excludedCourses.includes(course)) return false; 

    // 2. Check Search Term
    const matchText = course.toLowerCase().includes(normalizedTerm);
    if (!matchText) return false;

    // 3. Check Semester Filter
    if (selectedSemester) {
      const hasSemester = scheduleData.some(
        (e) => e.mataKuliah === course && String(e.semester) === selectedSemester
      );
      return hasSemester;
    }
    return true;
  });

  // Empty State
  if (courses.length === 0) {
    container.innerHTML = `
      <div class="course-empty">
        <i data-lucide="search-x"></i>
        <p>No courses found (or already passed)</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  // Render Items
  container.innerHTML = courses
    .map((course) => {
      const checked = selectedCourses.includes(course) ? "checked" : "";
      const id = `course-${course.replace(/\s/g, "-")}`;
      
      // Prerequisite Check for visual indicator
      const prereqCheck = checkPrerequisites(course, passedCoursesWithGrade);
      let statusClass = "";
      let statusHint = "";

      if (!prereqCheck.isMet) {
        statusClass = "prereq-missing";
        statusHint = `(Butuh: ${prereqCheck.missing.join(", ")})`;
      } else if (PREREQUISITE_MAP[course]) {
        statusClass = "prereq-met";
      }

      // We disable the checkbox visually but rely on the click handler to block selection
      const isDisabled = !prereqCheck.isMet && !checked ? 'disabled' : '';

      return `
        <div class="course-item ${checked ? "selected" : ""} ${statusClass}" 
             data-course="${course}">
            <input type="checkbox" id="${id}" value="${course}" ${checked} ${isDisabled}>
            <label for="${id}">
                ${course} 
                <span class="prereq-hint">${statusHint}</span>
            </label>
            ${!prereqCheck.isMet ? '<i data-lucide="alert-triangle" class="prereq-icon missing"></i>' : ''}
        </div>
    `;
    })
    .join("");

  // Re-attach Event Listeners (Same as before)
  document.querySelectorAll(".course-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      const checkbox = item.querySelector("input");
      const course = checkbox.value;

      const prereqCheck = checkPrerequisites(course, passedCoursesWithGrade);
      let isChecked = checkbox.checked;

      // Handle click on label/div area to prevent double toggle
      if (e.target.tagName === "LABEL" || e.target.closest('label')) {
        e.preventDefault(); 
        isChecked = !isChecked; // Simulate the intended toggle
      } else if (e.target.tagName !== "INPUT" && !e.target.closest('.prereq-icon')) {
        isChecked = !isChecked; // Simulate the intended toggle
      }

      if (!prereqCheck.isMet && isChecked) {
        e.preventDefault(); 
        showToast(`Gagal memilih: Prasyarat ${prereqCheck.missing.join(", ")} belum terpenuhi (Nilai harus D atau lebih tinggi).`, "error");
        // Ensure checkbox remains unchecked and list item unselected
        checkbox.checked = false;
        item.classList.remove("selected");
        return;
      }

      checkbox.checked = isChecked;

      if (checkbox.checked) {
        item.classList.add("selected");
        if (!selectedCourses.includes(course)) {
          selectedCourses.push(course);
        }
      } else {
        item.classList.remove("selected");
        selectedCourses = selectedCourses.filter((c) => c !== course);
      }

      updateSelectedCount();
    });
  });
  refreshIcons();
}

// Course selection helpers
function selectAllVisibleCourses() {
  const items = document.querySelectorAll(".course-item");
  items.forEach((item) => {
    const checkbox = item.querySelector("input");
    const course = checkbox.value;
    
    const prereqCheck = checkPrerequisites(course, passedCoursesWithGrade);
    if (!prereqCheck.isMet) {
      return; 
    }

    checkbox.checked = true;
    item.classList.add("selected");
    if (!selectedCourses.includes(course)) {
      selectedCourses.push(course);
    }
  });
  updateSelectedCount();
}

function clearAllSelectedCourses() {
  selectedCourses = [];
  const items = document.querySelectorAll(".course-item");
  items.forEach((item) => {
    const checkbox = item.querySelector("input");
    checkbox.checked = false;
    item.classList.remove("selected");
  });
  updateSelectedCount();
}

function getSelectedTotalSKS() {
  return selectedCourses.reduce((sum, course) => {
    const sks = courseSKSMap[course] || 0;
    return sum + sks;
  }, 0);
}

function updateSelectedCount() {
  document.getElementById(
    "selected-count"
  ).textContent = `${selectedCourses.length} selected`;
  const totalSKS = getSelectedTotalSKS();
  const selectedSKSEl = document.getElementById("selected-sks");
  if (selectedSKSEl) {
    selectedSKSEl.textContent = `${totalSKS} SKS`;
  }
}

function updateAvoidDaysList() {
  const container = document.getElementById("avoid-days-list");
  container.innerHTML = avoidDays
    .map(
      (day) => `
        <div class="badge">
            ${day}
            <button onclick="removeAvoidDay('${day}')">
                <i data-lucide="x"></i>
            </button>
        </div>
    `
    )
    .join("");
  refreshIcons();
}

function removeAvoidDay(day) {
  avoidDays = avoidDays.filter((d) => d !== day);
  updateAvoidDaysList();
}

function updateAvoidLecturersList() {
  const container = document.getElementById("avoid-lecturers-list");
  container.innerHTML = avoidLecturers
    .map(
      (lecturer) => `
        <div class="badge">
            ${lecturer}
            <button onclick="removeAvoidLecturer('${lecturer}')">
                <i data-lucide="x"></i>
            </button>
        </div>
    `
    )
    .join("");
  refreshIcons();
}

function removeAvoidLecturer(lecturer) {
  avoidLecturers = avoidLecturers.filter((l) => l !== lecturer);
  updateAvoidLecturersList();
}

function goToStep(step) {
  document
    .querySelectorAll(".builder-step")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById(`step-${step}`).classList.add("active");
}

// Generate Schedules
function generateSchedules() {
  if (selectedCourses.length === 0) {
    showToast("Pick at least one course!", "error");
    return;
  }

  const preferences = {
    maxSKS,
    avoidDays,
    avoidLecturers,
    classType,
    selectedCourses,
  };

  generatedSchedules = generateScheduleCombinations(preferences);

  if (generatedSchedules.length === 0) {
    showToast("No valid schedule combinations found!", "error");
    return;
  }

  currentScheduleIndex = 0;
  goToStep(3);
  renderGeneratedSchedule();
  showToast(
    `Created ${generatedSchedules.length} schedule combinations!`,
    "success"
  );
}

// Schedule Generation Algorithm
function generateScheduleCombinations(preferences) {
  // Filter schedules based on preferences
  const filtered = scheduleData.filter((entry) => {
    if (!preferences.selectedCourses.includes(entry.mataKuliah)) return false;

    const isIUP = entry.kelas.includes("IUP");
    if (preferences.classType === "IUP" && !isIUP) return false;
    if (preferences.classType === "Normal" && isIUP) return false;

    return true;
  });

  // Group by course
  const courseGroups = {};
  filtered.forEach((entry) => {
    if (!courseGroups[entry.mataKuliah]) {
      courseGroups[entry.mataKuliah] = [];
    }
    courseGroups[entry.mataKuliah].push(entry);
  });

  // Generate combinations
  const combinations = [];

  function generateCombos(courses, current, index) {
    if (index === courses.length) {
      // Check total SKS
      const totalSKS = current.reduce((sum, e) => sum + e.sks, 0);
      if (totalSKS <= preferences.maxSKS) {
        // Check for time conflicts
        if (!hasTimeConflicts(current)) {
          combinations.push([...current]);
        }
      }
      return;
    }

    const course = courses[index];
    const options = courseGroups[course];

    for (const option of options) {
      current.push(option);
      generateCombos(courses, current, index + 1);
      current.pop();
    }
  }

  generateCombos(preferences.selectedCourses, [], 0);

  // Score and sort combinations
  const scored = combinations.map((combo) => {
    let avoidedDayCount = 0;
    let avoidedLecturerCount = 0;
    let timeScore = 0;

    combo.forEach((entry) => {
      if (preferences.avoidDays.includes(entry.hari)) {
        avoidedDayCount++;
      }
      if (preferences.avoidLecturers.includes(entry.dosen)) {
        avoidedLecturerCount++;
      }

      const hour = parseInt(entry.jam.split(".")[0], 10);
      if (hour >= 8 && hour <= 16) {
        timeScore += 1;
      }
    });

    return { combo, avoidedDayCount, avoidedLecturerCount, timeScore };
  });

  // Split clean combinations (no penalties) from those with constraints
  const cleanCombos = scored.filter(
    (s) => s.avoidedDayCount === 0 && s.avoidedLecturerCount === 0
  );
  const constrainedCombos = scored.filter(
    (s) => s.avoidedDayCount > 0 || s.avoidedLecturerCount > 0
  );

  // Sort clean combos by time score (best first)
  cleanCombos.sort((a, b) => b.timeScore - a.timeScore);

  // Sort constrained combos by penalty first, then time score
  constrainedCombos.sort((a, b) => {
    const penaltyA =
      a.avoidedDayCount * 10000 + a.avoidedLecturerCount * 100;
    const penaltyB =
      b.avoidedDayCount * 10000 + b.avoidedLecturerCount * 100;

    if (penaltyA !== penaltyB) {
      return penaltyA - penaltyB;
    }
    return b.timeScore - a.timeScore;
  });

  // Gabungkan keduanya, dengan yang bersih diutamakan
  const finalSortedCombos = [...cleanCombos, ...constrainedCombos];

  // Keep top 20 combinations
  return finalSortedCombos.slice(0, 20).map((item) => item.combo);
}

// Check Time Conflicts
function hasTimeConflicts(entries) {
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i].hari === entries[j].hari) {
        const [start1, end1] = entries[i].jam.split("-");
        const [start2, end2] = entries[j].jam.split("-");

        if (timeOverlaps(start1, end1, start2, end2)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Time Overlaps Check
function timeOverlaps(start1, end1, start2, end2) {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  return s1 < e2 && e1 > s2;
}

// Convert Time to Minutes
function timeToMinutes(time) {
  const [hours, minutes] = time.split(".").map(Number);
  return hours * 60 + minutes;
}

// Render Generated Schedule
function renderGeneratedSchedule() {
  if (generatedSchedules.length === 0) return;

  const schedule = generatedSchedules[currentScheduleIndex];
  const totalSKS = schedule.reduce((sum, e) => sum + e.sks, 0);
  const avoidDayHits = schedule.filter((e) => avoidDays.includes(e.hari)).length;
  const avoidLecturerHits = schedule.filter((e) =>
    avoidLecturers.includes(e.dosen)
  ).length;

  document.getElementById(
    "results-count"
  ).textContent = `${generatedSchedules.length} combinations`;
  document.getElementById("results-sks").textContent = `${totalSKS} SKS`;
  document.getElementById("schedule-counter").textContent = `${
    currentScheduleIndex + 1
  } / ${generatedSchedules.length}`;

  // Enable/disable navigation buttons
  document.getElementById("prev-schedule").disabled =
    currentScheduleIndex === 0;
  document.getElementById("next-schedule").disabled =
    currentScheduleIndex === generatedSchedules.length - 1;

  // Render badges info
  const badgesContainer = document.getElementById("results-badges");
  if (badgesContainer) {
    badgesContainer.innerHTML = `
      <span class="results-badge">Avoided days hit: ${avoidDayHits}</span>
      <span class="results-badge">Avoided lecturers hit: ${avoidLecturerHits}</span>
    `;
  }

  // Group by day and render
  const grouped = groupScheduleByDay(schedule);
  const container = document.getElementById("generated-schedule");

  container.innerHTML = Object.entries(grouped)
    .sort((a, b) => {
      const dayOrder = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
      return dayOrder.indexOf(a[0]) - dayOrder.indexOf(b[0]);
    })
    .map(
      ([day, entries]) => `
            <div style="grid-column: 1 / -1;">
                <h3 style="margin: 1rem 0; color: hsl(var(--primary));">${day}</h3>
            </div>
            ${entries.map((entry) => createScheduleCard(entry)).join("")}
        `
    )
    .join("");
  refreshIcons();
}

// Copy current schedule to clipboard
function copyCurrentSchedule() {
  if (generatedSchedules.length === 0) return;
  const schedule = generatedSchedules[currentScheduleIndex];
  const lines = schedule
    .sort((a, b) => a.hari.localeCompare(b.hari) || a.jam.localeCompare(b.jam))
    .map(
      (e) =>
        `${e.mataKuliah} (${e.kelas}) - ${e.hari} ${e.jam} - ${e.dosen} - ${e.ruangan} - ${e.sks} SKS`
    );
  const text = lines.join("\n");
  navigator.clipboard
    .writeText(text)
    .then(() => showToast("Combination copied to clipboard", "success"))
    .catch(() => showToast("Failed to copy schedule", "error"));
}

// Group Schedule by Day
function groupScheduleByDay(schedule) {
  const grouped = {};
  schedule.forEach((entry) => {
    if (!grouped[entry.hari]) {
      grouped[entry.hari] = [];
    }
    grouped[entry.hari].push(entry);
  });

  // Sort by time within each day
  Object.keys(grouped).forEach((day) => {
    grouped[day].sort((a, b) => a.jam.localeCompare(b.jam));
  });

  return grouped;
}

// --- PREREQUISITE CHECK LOGIC ---
const PREREQUISITE_MAP = {
  "Kalkulus 2": ["Kalkulus 1"],
  "Teori Graf": ["Kalkulus 2"],
  "Matematika Diskrit": ["Kalkulus 2"],
  "Otomata": ["Kalkulus 2"],
  "Probabilitas dan Statistik": ["Matematika Diskrit"],
  "Pemodelan dan Simulasi": ["Probabilitas dan Statistik"],
  "Analisis Data Multivariat": ["Probabilitas dan Statistik"],
  "Simulasi Sistem Dinamis": ["Pemodelan dan Simulasi"],
  "Simulasi Berbasis Agen": ["Pemodelan dan Simulasi"],
  "Komputasi Numerik": ["Aljabar Linier"],
  "Struktur Data": ["Dasar Pemrograman"],
  "Perancangan dan Analisis Algoritma": ["Struktur Data"],
  "Pemrograman Pengolahan Sinyal": ["Perancangan dan Analisis Algoritma"],
  "Pemrograman Berorientasi Objek": ["Struktur Data"],
  "Pemrograman Perangkat Bergerak": ["Pemrograman Berorientasi Objek"],
  "Pemrograman Berbasis Kerangka Kerja": ["Pemrograman Berorientasi Objek"],
  "Interaksi Manusia dan Komputer": ["Pemrograman Berorientasi Objek"],
  "Grafika Komputer": ["Pemrograman Berorientasi Objek"],
  "Realitas X": ["Grafika Komputer"],
  "Konsep Kecerdasan Artifisial": ["Struktur Data"],
  "Pembelajaran Mesin": ["Konsep Kecerdasan Artifisial"],
  "Penambangan Data": ["Pembelajaran Mesin"],
  "Pengolahan Citra dan Visi Komputer": ["Pembelajaran Mesin"],
  "Pembelajaran Mendalam": ["Pembelajaran Mesin"],
  "Jaringan Komputer": ["Organisasi Komputer"],
  "Jaringan Komputer": ["Sistem Operasi"],
  "Keamanan Aplikasi": ["Sistem Operasi", "Organisasi Komputer"],
  "Jaringan Komputer": ["Sistem Operasi"],
  "Teknologi antar Jaringan": ["Jaringan Komputer"],
  "Jaringan Nirkabel": ["Jaringan Komputer"],
  "Keamanan Jaringan": ["Jaringan Komputer"],
  "Keamanan Informasi": ["Jaringan Komputer"],
  "Komputasi Pervasif dan Jaringan Sensor": ["Jaringan Komputer"],
  "Komputasi Bergerak ": ["Jaringan Komputer"],
  "Pemrograman Jaringan": ["Jaringan Komputer"],
  "Manajemen Basis Data": ["Sistem Basis Data"],
  "Rekayasa Sistem Berbasis Pengetahuan": ["Manajemen Basis Data"],
  "Tata Kelola Teknologi Informasi": ["Manajemen Basis Data"],
  "Sistem Perusahaan": ["Manajemen Basis Data"],
  "Basis Data Terdistribusi": ["Manajemen Basis Data"],
  "Audit Sistem": ["Manajemen Basis Data"],
  "Data Besar": ["Manajemen Basis Data"],
  "Pemrograman Web": ["Sistem Basis Data"],
  "Pemrograman Berbasis Antarmuka": ["Pemrograman Web"],
  "Perancangan Perangkat Lunak": ["Konsep Pengembangan Perangkat Lunak"],
  "Konstruksi Perangkat Lunak": ["Perancangan Perangkat Lunak"],
  "Arsitektur Perangkat Lunak": ["Perancangan Perangkat Lunak"],
  "Evolusi Perangkat Lunak": ["Perancangan Perangkat Lunak"],
};

// Check Prerequisite: Grade D or higher is considered a pass
function isPrerequisiteMet(prereqCourseName, passedCourses) {
  // Passing grades for a prerequisite: D, C, BC, B, AB, A
  const passingGradesForPrereq = ["A", "AB", "B", "BC", "C", "D"];
  const normalize = (str) => str.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizedPrereq = normalize(prereqCourseName);

  const passedEntry = passedCourses.find((p) =>
    normalize(p.name).includes(normalizedPrereq)
  );

  if (!passedEntry) {
    // Course was never taken
    return false;
  }
  
  // Check if the grade is one of the passing grades
  return passingGradesForPrereq.includes(passedEntry.grade.toUpperCase());
}

function checkPrerequisites(courseName, passedCourses) {
  const prereqs = PREREQUISITE_MAP[courseName];
  if (!prereqs) {
    // No prerequisites defined
    return { isMet: true, missing: [] };
  }

  const missingPrereqs = [];
  let isMet = true;

  for (const prereq of prereqs) {
    if (!isPrerequisiteMet(prereq, passedCourses)) {
      isMet = false;
      missingPrereqs.push(prereq);
    }
  }
  
  return { isMet, missing: missingPrereqs };
}

// --- Transcript / Transcript Reader Integration ---

function setupTranscriptListeners() {
  // Toggle visibility
  const toggleBtn = document.getElementById("toggle-transcript");
  const inputArea = document.getElementById("transcript-input-area");
  
  if (toggleBtn && inputArea) {
    toggleBtn.addEventListener("click", () => {
      const isHidden = inputArea.style.display === "none";
      inputArea.style.display = isHidden ? "block" : "none";
      toggleBtn.textContent = isHidden ? "Close" : "Open/Close";
    });
  }

  // Handle "Process" Button
  const btnProcess = document.getElementById("btn-process-transcript");
  if (btnProcess) {
    btnProcess.addEventListener("click", () => {
      processTranscript();
    });
  }

  // Handle "Enter" key in Textarea
  const txtArea = document.getElementById("transcript-text");
  if (txtArea) {
    txtArea.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault(); // Prevent new line
        processTranscript();
      }
    });
  }

  const btnRevert = document.getElementById("btn-revert-transcript");
  if (btnRevert) {
    btnRevert.addEventListener("click", () => {
      revertTranscript();
    });
  }
}

function revertTranscript(){  
  // 1. Check for any excluded courses
  if(transcriptExcludedCourses.length === 0){
    showToast("No excluded courses from the transcript!", "error");
    return;
  }

  let hiddenCount = transcriptExcludedCourses.length;

  // 2. Set excluded course to 0
  excludedCourses = excludedCourses.filter(item => !transcriptExcludedCourses.includes(item))
  transcriptExcludedCourses.length = 0;

  // 3. Refresh UI
  renderCourseSelector(); // This filters out the excludedCourses
  updateSelectedCount();

  showToast(`Done! Restored ${hiddenCount} passed courses.`, "success");
}

function processTranscript() {
  const rawText = document.getElementById("transcript-text").value;
  if (!rawText.trim()) {
    showToast("Teks transkrip kosong!", "error");
    return;
  }

  // 1. Parse text to get Name AND Grade for ALL entries
  const detectedCourses = parseTranscriptText(rawText); // Returns [{name: "...", grade: "..."}, ...]
  passedCoursesWithGrade = detectedCourses; // Store all detected courses and grades globally

  if (detectedCourses.length === 0) {
    showToast("Tidak ada mata kuliah yang terdeteksi.", "error");
    return;
  }

  let hiddenCount = 0;
  let keptCount = 0;

  // Define grades that are considered "Passed" and should be HIDDEN. (A, AB, B, BC)
  const exclusionGrades = ["A", "AB", "B", "BC"]; 
  excludedCourses = []; // Clear previous exclusions

  const normalize = (str) => str.toLowerCase().replace(/\s+/g, ' ').trim();

  // 2. Iterate through official courses and apply exclusion
  allCourses.forEach(officialCourse => {
    const normalizedOfficial = normalize(officialCourse);
    
    // Find if this official course exists in the user's transcript
    const match = detectedCourses.find(d => normalizedOfficial.includes(normalize(d.name)));

    if (match) {
      // Check the grade for EXCLUSION
      const grade = match.grade.toUpperCase();
      
      if (exclusionGrades.includes(grade)) {
        // High grade -> Hide it (Exclude)
        if (!excludedCourses.includes(officialCourse)) {
          excludedCourses.push(officialCourse);
          transcriptExcludedCourses.push(officialCourse);
          
          // Also remove from selected if it was currently selected
          if (selectedCourses.includes(officialCourse)) {
            selectedCourses = selectedCourses.filter(c => c !== officialCourse);
          }
          hiddenCount++;
        }
      } else {
        // Low grade (C, D, E) -> Keep it visible, but recorded in passedCoursesWithGrade
        keptCount++;
      }
    }
  });

  // 3. Refresh UI
  renderCourseSelector(); // This filters out excluded courses AND shows prereq status
  updateSelectedCount();
  
  showToast(`Selesai! ${hiddenCount} MK lulus disembunyikan. ${keptCount} MK nilai rendah tetap muncul.`, "success");
}

function parseTranscriptText(text) {
  const lines = text.split('\n');
  const results = []; // Array of objects { name, grade }
  let isInTable = false;

  const codeRegex = /^[A-Z]{2}\d+/; // Matches EF234, etc.

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect Table Boundaries
    if (trimmed.startsWith("Kode") && trimmed.includes("Nama Mata Kuliah")) {
      isInTable = true;
      return;
    }
    if (trimmed.startsWith("--- Tahap:") || trimmed.startsWith("Total Sks") || trimmed.startsWith("IP Tahap")) {
      isInTable = false;
      return;
    }

    // Process Line
    if (codeRegex.test(trimmed)) {
        // Split by whitespace
        const parts = trimmed.split(/\s+/);
        
        // Ensure structure: [Kode, Name..., SKS, Historis, Grade]
        if (parts.length >= 5) {
            // Last element is the Grade (Nilai)
            const grade = parts[parts.length - 1];
            
            // Name is between index 1 and -3
            const nameParts = parts.slice(1, -3);
            const fullName = nameParts.join(" ");
            
            if (fullName.length > 2) {
                results.push({
                    name: fullName,
                    grade: grade
                });
            }
        }
    }
  });

  return results;
}

// Toast Notification
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}
