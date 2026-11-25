const socket = io();

const totalVotes = document.getElementById("totalVotes");
const totalCandidates = document.getElementById("totalCandidates");
const totalOffices = document.getElementById("totalOffices");
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
const candidatePhotoInput = document.getElementById("candidatePhoto");
const choosePhotoButton = document.getElementById("choosePhotoButton");
const removePhotoButton = document.getElementById("removePhotoButton");
const photoPreview = document.getElementById("photoPreview");
const ballotPreview = document.getElementById("ballotPreview");
const manageList = document.getElementById("manageList");
const manageCount = document.getElementById("manageCount");
const manageMessage = document.getElementById("manageMessage");
const rowPhotoInput = document.getElementById("rowPhotoInput");
const editDialog = document.getElementById("editDialog");
const editForm = document.getElementById("editForm");
const editNameInput = document.getElementById("editName");
const editCategoryInput = document.getElementById("editCategory");
const editCategoryNote = document.getElementById("editCategoryNote");
const editPhotoPreview = document.getElementById("editPhotoPreview");
const editPhotoInput = document.getElementById("editPhotoInput");
const editChoosePhoto = document.getElementById("editChoosePhoto");
const editRemovePhoto = document.getElementById("editRemovePhoto");
const editMessage = document.getElementById("editMessage");
const editCancel = document.getElementById("editCancel");
const editSave = document.getElementById("editSave");
const removeDialog = document.getElementById("removeDialog");
const removeText = document.getElementById("removeText");
const removeCancel = document.getElementById("removeCancel");
const removeConfirm = document.getElementById("removeConfirm");

let categories = [];
let currentResults = { candidates: [], totalVotes: 0 };
let votesChart = null;
let candidateMessageTimer = null;
let manageMessageTimer = null;
let newPhoto = null;          // photo chosen in the Add Candidate form (data URL)
let photoTargetId = null;     // candidate whose photo is being changed from the list
let editingCandidate = null;  // candidate shown in the edit dialog
let editPhoto;                // undefined = unchanged, string = new photo, null = removed
let removingCandidate = null;

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
    renderAddPreview();
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
        Number(candidate.votes) === maxVotes ? "#1F5A42" : "#8FB09F"
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
                x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#E4E9E5" } },
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
    totalOffices.textContent = String(new Set(candidates.map(candidate => candidate.category_id)).size);
    renderManage();

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
            topLine.append(createAvatar(candidate), name);
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
            body: JSON.stringify({ name, categoryId, photo: newPhoto })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            showCandidateMessage(result.message || "Unable to add candidate.", "error");
            return;
        }

        candidateNameInput.value = "";
        candidateCategoryInput.value = "";
        newPhoto = null;
        renderAddPreview();
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

// ---------- Candidate photos ----------
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Crops the picture to a centered square and shrinks it, so uploads stay small and every avatar lines up.
function fileToSquareDataUrl(file, size = 400) {
    return new Promise((resolve, reject) => {
        if (!PHOTO_TYPES.includes(file.type)) {
            reject(new Error("Please choose a JPG, PNG or WebP image."));
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            reject(new Error("That image is too large. Please choose one under 10 MB."));
            return;
        }

        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            const side = Math.min(image.naturalWidth, image.naturalHeight);
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext("2d");
            context.fillStyle = "#FFFFFF";
            context.fillRect(0, 0, size, size);
            context.drawImage(
                image,
                (image.naturalWidth - side) / 2,
                (image.naturalHeight - side) / 2,
                side,
                side,
                0,
                0,
                size,
                size
            );
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("That file could not be read as an image."));
        };
        image.src = url;
    });
}

function setAvatarContent(element, name, photoUrl, fallbackText) {
    element.textContent = "";
    element.classList.toggle("initials", !photoUrl);
    if (photoUrl) {
        const image = document.createElement("img");
        image.src = photoUrl;
        image.alt = "";
        element.appendChild(image);
    } else {
        element.textContent = fallbackText !== undefined ? fallbackText : getInitials(name);
    }
}

async function sendCandidateRequest(url, method, body) {
    const options = { method };
    if (body) {
        options.headers = { "Content-Type": "application/json" };
        options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    let result = {};
    try {
        result = await response.json();
    } catch (error) {
        // The server answered without JSON; fall through to the generic message below.
    }
    if (!response.ok || !result.success) {
        throw new Error(result.message || "Something went wrong. Please try again.");
    }
    return result;
}

function showManageMessage(text, kind) {
    window.clearTimeout(manageMessageTimer);
    manageMessage.textContent = text;
    manageMessage.className = kind;
    manageMessage.classList.remove("fade-out");
    manageMessageTimer = window.setTimeout(() => {
        manageMessage.classList.add("fade-out");
    }, 3500);
}

// ---------- Add Candidate: photo and ballot preview ----------
function renderAddPreview() {
    const name = candidateNameInput.value.trim() || "Candidate Name";
    const category = categories.find(item => item.id === candidateCategoryInput.value);

    ballotPreview.innerHTML = "";
    const avatar = document.createElement("span");
    avatar.className = "avatar lg";
    setAvatarContent(avatar, name, newPhoto);

    const text = document.createElement("span");
    text.className = "preview-text";
    const title = document.createElement("b");
    title.textContent = name;
    const office = document.createElement("small");
    office.textContent = category ? category.name : "Office";
    text.append(title, office);

    const check = document.createElement("span");
    check.className = "preview-check";
    check.textContent = "\u2713";
    ballotPreview.append(avatar, text, check);

    setAvatarContent(photoPreview, "", newPhoto, "+");
    removePhotoButton.hidden = !newPhoto;
    choosePhotoButton.textContent = newPhoto ? "Change photo" : "Choose photo";
}

choosePhotoButton.addEventListener("click", () => candidatePhotoInput.click());
removePhotoButton.addEventListener("click", () => {
    newPhoto = null;
    renderAddPreview();
});
candidatePhotoInput.addEventListener("change", async () => {
    const file = candidatePhotoInput.files[0];
    candidatePhotoInput.value = "";
    if (!file) return;
    try {
        newPhoto = await fileToSquareDataUrl(file);
        clearCandidateMessage();
        renderAddPreview();
    } catch (error) {
        showCandidateMessage(error.message, "error");
    }
});
candidateNameInput.addEventListener("input", renderAddPreview);
candidateCategoryInput.addEventListener("change", renderAddPreview);

// ---------- Manage Candidates ----------
function renderManage() {
    const candidates = currentResults.candidates;
    const withPhotos = candidates.filter(candidate => candidate.photo).length;
    manageCount.textContent = candidates.length === 0
        ? ""
        : `${candidates.length} ${candidates.length === 1 ? "candidate" : "candidates"} · ${withPhotos} with photos`;
    manageList.innerHTML = "";

    if (candidates.length === 0) {
        const empty = document.createElement("p");
        empty.className = "manage-empty";
        empty.textContent = "No candidates yet. Add one using the form.";
        manageList.appendChild(empty);
        return;
    }

    const officeIndex = candidate => categories.findIndex(item => item.id === candidate.category_id);
    [...candidates]
        .sort((a, b) => officeIndex(a) - officeIndex(b) || a.id - b.id)
        .forEach(candidate => {
            const category = categories.find(item => item.id === candidate.category_id);
            const votes = Number(candidate.votes) || 0;

            const row = document.createElement("div");
            row.className = "manage-row";

            const avatar = createAvatar(candidate);
            avatar.classList.add("lg");

            const info = document.createElement("div");
            info.className = "manage-info";
            const name = document.createElement("b");
            name.textContent = candidate.name;
            const detail = document.createElement("small");
            detail.textContent = `${category ? category.name : "Office"} · ${votes} ${votes === 1 ? "vote" : "votes"}` +
                (candidate.photo ? "" : " · No photo yet");
            info.append(name, detail);

            const actions = document.createElement("div");
            actions.className = "manage-actions";
            const photoButton = document.createElement("button");
            photoButton.type = "button";
            photoButton.className = "small-button";
            photoButton.textContent = candidate.photo ? "Change photo" : "Upload photo";
            photoButton.addEventListener("click", () => {
                photoTargetId = candidate.id;
                rowPhotoInput.click();
            });
            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "small-button";
            editButton.textContent = "Edit";
            editButton.addEventListener("click", () => openEditDialog(candidate));
            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "small-button danger-button";
            removeButton.textContent = "Remove";
            removeButton.addEventListener("click", () => openRemoveDialog(candidate, category, votes));
            actions.append(photoButton, editButton, removeButton);

            row.append(avatar, info, actions);
            manageList.appendChild(row);
        });
}

rowPhotoInput.addEventListener("change", async () => {
    const file = rowPhotoInput.files[0];
    rowPhotoInput.value = "";
    if (!file || photoTargetId === null) return;
    const id = photoTargetId;
    photoTargetId = null;
    try {
        const photo = await fileToSquareDataUrl(file);
        await sendCandidateRequest(`/api/candidates/${id}`, "PUT", { photo });
        showManageMessage("Photo updated.", "success");
    } catch (error) {
        showManageMessage(error.message, "error");
    }
});

// ---------- Edit dialog ----------
function renderEditPhoto() {
    const photoUrl = editPhoto === undefined ? editingCandidate.photo : editPhoto;
    setAvatarContent(editPhotoPreview, editNameInput.value || editingCandidate.name, photoUrl);
    editRemovePhoto.hidden = !photoUrl;
    editChoosePhoto.textContent = photoUrl ? "Change photo" : "Choose photo";
}

function openEditDialog(candidate) {
    editingCandidate = candidate;
    editPhoto = undefined;
    editNameInput.value = candidate.name;
    editCategoryInput.innerHTML = "";
    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category.id;
        option.textContent = category.name;
        editCategoryInput.appendChild(option);
    });
    editCategoryInput.value = candidate.category_id;
    const locked = (Number(candidate.votes) || 0) > 0;
    editCategoryInput.disabled = locked;
    editCategoryNote.hidden = !locked;
    editMessage.textContent = "";
    renderEditPhoto();
    editDialog.showModal();
    editNameInput.focus();
}

editNameInput.addEventListener("input", () => {
    if (editingCandidate) renderEditPhoto();
});
editChoosePhoto.addEventListener("click", () => editPhotoInput.click());
editRemovePhoto.addEventListener("click", () => {
    editPhoto = null;
    renderEditPhoto();
});
editPhotoInput.addEventListener("change", async () => {
    const file = editPhotoInput.files[0];
    editPhotoInput.value = "";
    if (!file) return;
    try {
        editPhoto = await fileToSquareDataUrl(file);
        editMessage.textContent = "";
        renderEditPhoto();
    } catch (error) {
        editMessage.textContent = error.message;
    }
});
editCancel.addEventListener("click", () => editDialog.close());

editForm.addEventListener("submit", async event => {
    event.preventDefault();
    const name = editNameInput.value.trim();
    if (!name) {
        editMessage.textContent = "Please enter a candidate name";
        return;
    }

    const changes = { name };
    if (!editCategoryInput.disabled) {
        changes.categoryId = editCategoryInput.value;
    }
    if (typeof editPhoto === "string") {
        changes.photo = editPhoto;
    } else if (editPhoto === null) {
        changes.removePhoto = true;
    }

    editSave.disabled = true;
    try {
        await sendCandidateRequest(`/api/candidates/${editingCandidate.id}`, "PUT", changes);
        editDialog.close();
        showManageMessage("Candidate updated.", "success");
    } catch (error) {
        editMessage.textContent = error.message;
    } finally {
        editSave.disabled = false;
    }
});

// ---------- Remove dialog ----------
function openRemoveDialog(candidate, category, votes) {
    removingCandidate = candidate;
    removeText.textContent =
        `Remove ${candidate.name} from ${category ? category.name : "the ballot"}? ` +
        (votes > 0 ? `Their ${votes} ${votes === 1 ? "vote" : "votes"} will also be removed from the results. ` : "") +
        "This cannot be undone.";
    removeDialog.showModal();
}

removeCancel.addEventListener("click", () => removeDialog.close());
removeConfirm.addEventListener("click", async () => {
    if (!removingCandidate) return;
    const candidate = removingCandidate;
    removeConfirm.disabled = true;
    try {
        await sendCandidateRequest(`/api/candidates/${candidate.id}`, "DELETE");
        removeDialog.close();
        showManageMessage(`${candidate.name} was removed.`, "success");
    } catch (error) {
        removeDialog.close();
        showManageMessage(error.message, "error");
    } finally {
        removeConfirm.disabled = false;
        removingCandidate = null;
    }
});

loadInitialResults();
