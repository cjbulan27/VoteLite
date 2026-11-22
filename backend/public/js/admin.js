const socket = io();

const totalVotes = document.getElementById("totalVotes");
const totalCandidates = document.getElementById("totalCandidates");
const candidateResults = document.getElementById("candidateResults");
const connection = document.getElementById("connection");
const categoryFilter = document.getElementById("categoryFilter");
const chartCanvas = document.getElementById("votesChart");
const chartWrap = document.querySelector(".chart-wrap");
const chartEmpty = document.getElementById("chartEmpty");
const addCandidateForm = document.getElementById("addCandidateForm");
const candidateNameInput = document.getElementById("candidateName");
const candidateCategoryInput = document.getElementById("candidateCategory");
const candidateMessage = document.getElementById("candidateMessage");
const addCandidateButton = document.getElementById("addCandidateButton");

let categories = [];
let currentResults = { candidates: [], totalVotes: 0 };
let votesChart = null;
let candidateMessageTimer = null;

function populateCategoryOptions() {
    const selectedFilter = categoryFilter.value || "all";
    const selectedFormCategory = candidateCategoryInput.value;
    categoryFilter.innerHTML = '<option value="all">All categories</option>';
    candidateCategoryInput.innerHTML =
        '<option value="" disabled selected>Select the office they are running for</option>';

    categories.forEach(category => {
        const filterOption = document.createElement("option");
        filterOption.value = category.id;
        filterOption.textContent = category.name;
        categoryFilter.appendChild(filterOption);

        const formOption = filterOption.cloneNode(true);
        candidateCategoryInput.appendChild(formOption);
    });

    if ([...categoryFilter.options].some(option => option.value === selectedFilter)) {
        categoryFilter.value = selectedFilter;
    }
    if ([...candidateCategoryInput.options].some(option => option.value === selectedFormCategory)) {
        candidateCategoryInput.value = selectedFormCategory;
    }
}

function getVisibleCategories() {
    return categoryFilter.value === "all"
        ? categories
        : categories.filter(category => category.id === categoryFilter.value);
}

function renderChart(candidates, category) {
    const categoryCandidates = candidates.filter(
        candidate => !category || candidate.category_id === category.id
    );
    const hasVotes = categoryCandidates.some(candidate => Number(candidate.votes) > 0);

    chartEmpty.hidden = hasVotes;
    chartWrap.hidden = !hasVotes;
    if (!hasVotes) {
        if (votesChart) {
            votesChart.destroy();
            votesChart = null;
        }
        return;
    }

    const maxVotes = Math.max(...categoryCandidates.map(candidate => Number(candidate.votes) || 0));
    const labels = categoryCandidates.map(candidate => category
        ? candidate.name
        : `${categories.find(item => item.id === candidate.category_id)?.name || "Category"} · ${candidate.name}`);
    const values = categoryCandidates.map(candidate => Number(candidate.votes) || 0);
    const colors = categoryCandidates.map(candidate =>
        Number(candidate.votes) === maxVotes ? "#16a36a" : "#4383d3"
    );

    if (votesChart) {
        votesChart.data.labels = labels;
        votesChart.data.datasets[0].data = values;
        votesChart.data.datasets[0].backgroundColor = colors;
        votesChart.update();
        return;
    }

    votesChart = new Chart(chartCanvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Votes",
                data: values,
                backgroundColor: colors,
                borderRadius: 6,
                maxBarThickness: 36
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: context => `${context.parsed.x} votes` } }
            },
            scales: {
                x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#edf1f5" } },
                y: { grid: { display: false } }
            }
        }
    });
}

function renderResults(data = currentResults) {
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    currentResults = {
        candidates,
        totalVotes: Number.isFinite(data.totalVotes) ? data.totalVotes : 0
    };

    totalVotes.textContent = String(currentResults.totalVotes);
    totalCandidates.textContent = String(candidates.length);

    const selectedCategory = categories.find(item => item.id === categoryFilter.value);
    renderChart(candidates, selectedCategory);
    candidateResults.innerHTML = "";

    if (candidates.length === 0) {
        candidateResults.textContent = "No candidates have been added yet.";
        return;
    }

    getVisibleCategories().forEach(category => {
        const groupCandidates = candidates.filter(
            candidate => candidate.category_id === category.id
        );
        if (groupCandidates.length === 0) return;

        const categoryTotal = groupCandidates.reduce(
            (sum, candidate) => sum + (Number(candidate.votes) || 0),
            0
        );
        const group = document.createElement("section");
        group.className = "result-category";

        const heading = document.createElement("div");
        heading.className = "result-category-heading";
        const title = document.createElement("h3");
        title.textContent = category.name;
        const subtitle = document.createElement("p");
        subtitle.textContent = `${categoryTotal} ${categoryTotal === 1 ? "vote" : "votes"}`;
        heading.append(title, subtitle);
        group.appendChild(heading);

        const maximum = Math.max(0, ...groupCandidates.map(candidate => Number(candidate.votes) || 0));
        groupCandidates.forEach(candidate => {
            const count = Number(candidate.votes) || 0;
            const percentage = categoryTotal > 0 ? (count / categoryTotal) * 100 : 0;
            const card = document.createElement("article");
            card.className = "result-card";

            const topLine = document.createElement("div");
            topLine.className = "result-topline";
            const name = document.createElement("h4");
            name.textContent = candidate.name;
            topLine.appendChild(name);
            if (count > 0 && count === maximum) {
                const badge = document.createElement("span");
                badge.className = "leading-badge";
                badge.textContent = "Leading";
                topLine.appendChild(badge);
            }

            const totals = document.createElement("p");
            totals.className = "result-totals";
            totals.textContent = `${count} ${count === 1 ? "vote" : "votes"} · ${percentage.toFixed(1)}%`;

            const progress = document.createElement("div");
            progress.className = "progress-bar";
            progress.setAttribute("role", "progressbar");
            progress.setAttribute("aria-valuenow", percentage.toFixed(1));
            progress.setAttribute("aria-valuemin", "0");
            progress.setAttribute("aria-valuemax", "100");
            const fill = document.createElement("div");
            fill.className = "progress-fill";
            fill.style.width = `${percentage}%`;
            if (count > 0 && count === maximum) fill.classList.add("progress-leader");
            progress.appendChild(fill);

            card.append(topLine, totals, progress);
            group.appendChild(card);
        });
        candidateResults.appendChild(group);
    });
}

function showCandidateMessage(text, kind) {
    window.clearTimeout(candidateMessageTimer);
    candidateMessage.textContent = text;
    candidateMessage.className = kind;
    candidateMessage.classList.remove("fade-out");
    candidateMessageTimer = window.setTimeout(() => {
        candidateMessage.classList.add("fade-out");
    }, 3000);
}

function clearCandidateMessage() {
    window.clearTimeout(candidateMessageTimer);
    candidateMessageTimer = null;
    candidateMessage.textContent = "";
    candidateMessage.className = "";
}

async function loadInitialResults() {
    try {
        const categoryResponse = await fetch("/api/categories");
        if (!categoryResponse.ok) {
            throw new Error("Failed to load office categories.");
        }
        const loadedCategories = await categoryResponse.json();
        if (!Array.isArray(loadedCategories) || loadedCategories.length === 0) {
            throw new Error("The category list is empty or invalid.");
        }
        categories = loadedCategories;
        populateCategoryOptions();
    } catch (error) {
        console.error(error);
    }

    try {
        const resultsResponse = await fetch("/api/results");
        if (!resultsResponse.ok) {
            throw new Error("Failed to load voting results.");
        }
        const results = await resultsResponse.json();
        if (categories.length === 0 &&
            Array.isArray(results.categories) &&
            results.categories.length > 0) {
            categories = results.categories;
            populateCategoryOptions();
        }
        renderResults(results);
    } catch (error) {
        console.error(error);
        candidateResults.textContent = "Unable to load voting results. Please refresh the page.";
    }

    if (categories.length === 0) {
        showCandidateMessage("Unable to load office categories. Please refresh the page.", "error");
    }
}

addCandidateForm.addEventListener("submit", async event => {
    event.preventDefault();
    clearCandidateMessage();
    const name = candidateNameInput.value.trim();
    const categoryId = String(candidateCategoryInput.value || "").trim();
    console.log("Add candidate form values:", { name, categoryId });

    if (!name) {
        showCandidateMessage("Please enter a candidate name", "error");
        return;
    }
    if (!categories.some(category => String(category.id) === categoryId)) {
        showCandidateMessage("Please select the office they are running for", "error");
        return;
    }

    addCandidateButton.disabled = true;
    try {
        const response = await fetch("/api/candidates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, categoryId })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            showCandidateMessage(result.message || "Unable to add candidate.", "error");
            return;
        }

        candidateNameInput.value = "";
        candidateCategoryInput.value = "";
        showCandidateMessage(result.message, "success");
    } catch (error) {
        console.error(error);
        showCandidateMessage("Unable to add candidate. Please try again.", "error");
    } finally {
        addCandidateButton.disabled = false;
    }
});

categoryFilter.addEventListener("change", () => renderResults());

socket.on("connect", () => {
    connection.textContent = "Live updates connected";
    connection.classList.add("connected");
    connection.classList.remove("disconnected");
});

socket.on("disconnect", () => {
    connection.textContent = "Live updates disconnected";
    connection.classList.add("disconnected");
    connection.classList.remove("connected");
});

socket.on("vote:updated", data => {
    if (Array.isArray(data.categories) && data.categories.length) {
        categories = data.categories;
        populateCategoryOptions();
    }
    renderResults(data);
});

loadInitialResults();
