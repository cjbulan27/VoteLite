const socket = io();

const candidateList = document.getElementById("candidateList");
const voterIdInput = document.getElementById("voterId");
const voteButton = document.getElementById("voteButton");
const message = document.getElementById("message");
const reviewPanel = document.getElementById("reviewPanel");
const ballotSummary = document.getElementById("ballotSummary");
const backButton = document.getElementById("backButton");
const confirmButton = document.getElementById("confirmButton");
const reviewMessage = document.getElementById("reviewMessage");

let categories = [];
let candidates = [];
const selectedIds = new Set();

function getSelectedForCategory(categoryId) {
    return candidates.filter(candidate =>
        candidate.category_id === categoryId && selectedIds.has(candidate.id)
    );
}

function renderCandidates() {
    candidateList.innerHTML = "";

    if (categories.length === 0) {
        candidateList.textContent = "Unable to load ballot categories.";
        voteButton.disabled = true;
        return;
    }

    categories.forEach(category => {
        const section = document.createElement("section");
        section.className = "category-section";

        const heading = document.createElement("div");
        heading.className = "category-heading";

        const title = document.createElement("h3");
        title.textContent = category.name;

        const limitLabel = document.createElement("p");
        limitLabel.className = "category-limit";
        limitLabel.textContent = category.max_votes === 1
            ? "Select 1 candidate"
            : `Select up to ${category.max_votes} candidates`;

        const selected = getSelectedForCategory(category.id).length;
        const counter = document.createElement("p");
        counter.className = "category-counter";
        counter.textContent = `Selected: ${selected} / ${category.max_votes}`;

        const categoryCandidates = candidates.filter(
            candidate => candidate.category_id === category.id
        );
        const grid = document.createElement("div");
        grid.className = "candidate-grid";

        if (categoryCandidates.length === 0) {
            const empty = document.createElement("p");
            empty.className = "category-empty";
            empty.textContent = "Candidates will appear here when they are added.";
            grid.appendChild(empty);
        }

        categoryCandidates.forEach(candidate => {
            const isSelected = selectedIds.has(candidate.id);
            const atLimit = selected >= category.max_votes;
            const card = document.createElement("article");
            card.className = `candidate-card${isSelected ? " selected" : ""}`;

            const name = document.createElement("h4");
            name.textContent = candidate.name;

            const description = document.createElement("p");
            description.textContent = category.name;

            const button = document.createElement("button");
            button.type = "button";
            button.className = "select-button";
            button.disabled = category.max_votes > 1 && !isSelected && atLimit;
            button.setAttribute("aria-pressed", String(isSelected));
            button.textContent = isSelected ? "✓ Selected · Unselect" : "Select Candidate";
            button.addEventListener("click", () => {
                if (selectedIds.has(candidate.id)) {
                    selectedIds.delete(candidate.id);
                } else {
                    // Single-vote categories replace the previous candidate; multi-vote categories obey their configured cap.
                    if (category.max_votes === 1) {
                        getSelectedForCategory(category.id).forEach(item => selectedIds.delete(item.id));
                    } else if (getSelectedForCategory(category.id).length >= category.max_votes) {
                        return;
                    }
                    selectedIds.add(candidate.id);
                }
                message.textContent = "";
                message.className = "";
                renderCandidates();
            });

            card.append(name, description, button);
            grid.appendChild(card);
        });

        const limitMessage = document.createElement("p");
        limitMessage.className = "limit-message";
        limitMessage.textContent = selected >= category.max_votes && category.max_votes > 1
            ? `Maximum of ${category.max_votes} reached`
            : "";

        heading.append(title, limitLabel, counter);
        section.append(heading, grid, limitMessage);
        candidateList.appendChild(section);
    });

    voteButton.disabled = candidates.length === 0;
}

async function loadBallot() {
    try {
        const [categoryResponse, candidateResponse] = await Promise.all([
            fetch("/api/categories"),
            fetch("/api/candidates")
        ]);
        if (!categoryResponse.ok || !candidateResponse.ok) {
            throw new Error("Failed to load ballot data.");
        }
        categories = await categoryResponse.json();
        candidates = await candidateResponse.json();
        const validIds = new Set(candidates.map(candidate => candidate.id));
        selectedIds.forEach(id => {
            if (!validIds.has(id)) selectedIds.delete(id);
        });
        renderCandidates();
    } catch (error) {
        console.error(error);
        candidateList.textContent = "Unable to load candidates. Please refresh the page.";
        voteButton.disabled = true;
    }
}

function showReview() {
    const voterId = voterIdInput.value.trim();
    if (!voterId) {
        message.textContent = "Enter your Voter ID to continue.";
        message.className = "error";
        voterIdInput.focus();
        return;
    }
    if (selectedIds.size === 0) {
        message.textContent = "Select at least one candidate before reviewing your ballot.";
        message.className = "error";
        return;
    }

    ballotSummary.innerHTML = "";
    categories.forEach(category => {
        const row = document.createElement("div");
        row.className = "summary-category";
        const title = document.createElement("h3");
        title.textContent = category.name;
        const names = document.createElement("p");
        const selected = getSelectedForCategory(category.id);
        names.textContent = selected.length
            ? selected.map(candidate => candidate.name).join(", ")
            : "No candidate selected";
        row.append(title, names);
        ballotSummary.appendChild(row);
    });

    reviewMessage.textContent = "";
    reviewMessage.className = "";
    reviewPanel.hidden = false;
    reviewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function submitBallot() {
    const voterId = voterIdInput.value.trim();
    confirmButton.disabled = true;
    reviewMessage.textContent = "";
    reviewMessage.className = "";

    try {
        const response = await fetch("/api/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ voterId, candidateIds: Array.from(selectedIds) })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            reviewMessage.textContent = result.message || "Unable to submit your ballot.";
            reviewMessage.className = "error";
            return;
        }

        selectedIds.clear();
        voterIdInput.value = "";
        reviewPanel.hidden = true;
        message.textContent = result.message;
        message.className = "success";
        window.scrollTo({ top: 0, behavior: "smooth" });
        renderCandidates();
    } catch (error) {
        console.error(error);
        reviewMessage.textContent = "Unable to submit your ballot. Please try again.";
        reviewMessage.className = "error";
    } finally {
        confirmButton.disabled = false;
    }
}

voteButton.addEventListener("click", showReview);
backButton.addEventListener("click", () => {
    reviewPanel.hidden = true;
    voterIdInput.focus();
});
confirmButton.addEventListener("click", submitBallot);
socket.on("vote:updated", loadBallot);
loadBallot();
