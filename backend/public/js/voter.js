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

const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const stepItems = document.querySelectorAll("#steps li");

const idPanel = document.getElementById("idPanel");
const ballotPanel = document.getElementById("ballotPanel");
const voterNameInput = document.getElementById("voterName");
const doneScreen = document.getElementById("doneScreen");
const doneName = document.getElementById("doneName");
const doneVoterId = document.getElementById("doneVoterId");
const doneOffices = document.getElementById("doneOffices");
const homeButton = document.getElementById("homeButton");

const CHECK_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="#fff" stroke-width="2"/></svg>';

let categories = [];
let candidates = [];
const selectedIds = new Set();

function getInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
}

// Shows the candidate's uploaded photo when there is one, otherwise their initials.
function createAvatar(candidate) {
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    if (candidate.photo) {
        const image = document.createElement("img");
        image.src = candidate.photo;
        image.alt = "";
        image.loading = "lazy";
        avatar.appendChild(image);
    } else {
        avatar.classList.add("initials");
        avatar.textContent = getInitials(candidate.name);
    }
    return avatar;
}

// Only offices that actually have candidates are shown on the ballot.
function getActiveCategories() {
    return categories.filter(category =>
        candidates.some(candidate => candidate.category_id === category.id)
    );
}

function setStep(current) {
    stepItems.forEach((item, index) => {
        item.classList.toggle("on", index + 1 === current);
        item.classList.toggle("done", index + 1 < current);
    });
}

function updateProgress() {
    const active = getActiveCategories();
    const done = active.filter(category =>
        getSelectedForCategory(category.id).length > 0
    ).length;
    progressText.textContent = `${done} of ${active.length} offices selected`;
    progressFill.style.width = active.length
        ? `${(done / active.length) * 100}%`
        : "0";
}

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

    const activeCategories = getActiveCategories();
    if (activeCategories.length === 0) {
        candidateList.textContent = "No candidates have been added yet. Please check back soon.";
        voteButton.disabled = true;
        updateProgress();
        return;
    }

    activeCategories.forEach(category => {
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

        categoryCandidates.forEach(candidate => {
            const isSelected = selectedIds.has(candidate.id);
            const atLimit = selected >= category.max_votes;
            const card = document.createElement("button");
            card.type = "button";
            card.className = `candidate-card${isSelected ? " selected" : ""}`;
            card.disabled = category.max_votes > 1 && !isSelected && atLimit;
            card.setAttribute("aria-pressed", String(isSelected));

            const avatar = createAvatar(candidate);

            const text = document.createElement("span");
            text.className = "candidate-text";
            const name = document.createElement("b");
            name.textContent = candidate.name;
            const description = document.createElement("small");
            description.textContent = isSelected ? "Selected · tap to unselect" : "Tap to select";
            text.append(name, description);

            const mark = document.createElement("span");
            mark.className = "check";
            mark.innerHTML = isSelected ? CHECK_ICON : "";

            card.append(avatar, text, mark);
            card.addEventListener("click", () => {
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
    updateProgress();
    setStep(!doneScreen.hidden ? 4 : !reviewPanel.hidden ? 3 : selectedIds.size > 0 ? 2 : 1);
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
    getActiveCategories().forEach(category => {
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
    setStep(3);
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

        const officesVoted = getActiveCategories().filter(category =>
            getSelectedForCategory(category.id).length > 0
        ).length;
        const displayName = voterNameInput.value.trim();

        selectedIds.clear();
        doneVoterId.textContent = voterId;
        doneOffices.textContent = String(officesVoted);
        doneName.textContent = displayName
            ? `Thank you for taking part in the election, ${displayName}.`
            : "Thank you for taking part in the election.";
        voterIdInput.value = "";
        voterNameInput.value = "";
        message.textContent = "";
        message.className = "";

        reviewPanel.hidden = true;
        idPanel.hidden = true;
        ballotPanel.hidden = true;
        doneScreen.hidden = false;
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
    setStep(selectedIds.size > 0 ? 2 : 1);
    voterIdInput.focus();
});
confirmButton.addEventListener("click", submitBallot);
homeButton.addEventListener("click", () => {
    doneScreen.hidden = true;
    idPanel.hidden = false;
    ballotPanel.hidden = false;
    renderCandidates();
    window.scrollTo({ top: 0, behavior: "smooth" });
    voterIdInput.focus();
});
socket.on("vote:updated", loadBallot);
loadBallot();
