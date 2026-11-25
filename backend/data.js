const categories = [
    { id: "president", name: "President", max_votes: 1 },
    { id: "vice_president", name: "Vice President", max_votes: 1 },
    { id: "senator", name: "Senator", max_votes: 12 },
    { id: "governor", name: "Governor", max_votes: 1 },
    { id: "congress", name: "Congress", max_votes: 1 },
    { id: "mayor", name: "Mayor", max_votes: 1 },
    { id: "vice_mayor", name: "Vice Mayor", max_votes: 1 }
];

const candidates = [];
const votes = [];
const voterIds = new Set();
let nextCandidateId = 1;

// Candidate photos are kept in memory (like everything else here) and served by their own URL,
// so live updates do not have to carry the image data.
const photos = new Map();
let nextPhotoVersion = 1;
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;

function getCandidates() {
    return candidates.map(candidate => ({
        ...candidate,
        photo: photos.has(candidate.id)
            ? `/api/candidates/${candidate.id}/photo?v=${photos.get(candidate.id).version}`
            : null,
        votes: votes.filter(vote => vote.candidate_id === candidate.id).length
    }));
}

function parsePhoto(dataUrl) {
    const match = typeof dataUrl === "string"
        ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
        : null;
    if (!match) {
        return { success: false, message: "The photo must be a JPG, PNG or WebP image." };
    }

    const mime = match[1];
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES) {
        return { success: false, message: "The photo is too large. Please choose a smaller image." };
    }

    const looksValid =
        (mime === "image/jpeg" && buffer[0] === 0xFF && buffer[1] === 0xD8) ||
        (mime === "image/png" && buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47]))) ||
        (mime === "image/webp" &&
            buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
            buffer.subarray(8, 12).toString("ascii") === "WEBP");
    if (!looksValid) {
        return { success: false, message: "The photo file is not a valid image." };
    }
    return { success: true, mime, buffer };
}

function storePhoto(candidateId, parsedPhoto) {
    photos.set(candidateId, {
        mime: parsedPhoto.mime,
        buffer: parsedPhoto.buffer,
        version: nextPhotoVersion++
    });
}

function getPhoto(candidateId) {
    return photos.get(candidateId) || null;
}

function submitBallot(voterId, candidateIds) {
    if (!voterId) {
        return { success: false, message: "Voter ID is required." };
    }

    const normalizedVoterId = voterId.trim().toLowerCase();
    if (voterIds.has(normalizedVoterId)) {
        return { success: false, message: "This Voter ID has already voted." };
    }

    if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
        return { success: false, message: "Select at least one candidate." };
    }

    const selectedIds = candidateIds.map(Number);
    if (selectedIds.some(id => !Number.isInteger(id)) ||
        new Set(selectedIds).size !== selectedIds.length) {
        return { success: false, message: "The ballot contains an invalid selection." };
    }

    const selectedCandidates = selectedIds.map(id =>
        candidates.find(candidate => candidate.id === id)
    );
    if (selectedCandidates.some(candidate => !candidate)) {
        return { success: false, message: "The ballot contains an invalid candidate." };
    }

    const selectedByCategory = new Map();
    selectedCandidates.forEach(candidate => {
        selectedByCategory.set(
            candidate.category_id,
            (selectedByCategory.get(candidate.category_id) || 0) + 1
        );
    });

    for (const [categoryId, count] of selectedByCategory) {
        const category = categories.find(item => item.id === categoryId);
        if (!category || count > category.max_votes) {
            return {
                success: false,
                message: `You may select up to ${category ? category.max_votes : 0} candidate(s) in this category.`
            };
        }
    }

    selectedCandidates.forEach(candidate => {
        votes.push({
            voter_id: normalizedVoterId,
            candidate_id: candidate.id,
            category_id: candidate.category_id
        });
    });
    voterIds.add(normalizedVoterId);

    return { success: true };
}

function addCandidate(name, categoryId, photo) {
    const category = categories.find(item => item.id === categoryId);
    if (!category) {
        return { success: false, message: "Select a valid category." };
    }

    const cleanName = name.trim();
    if (!cleanName) {
        return { success: false, message: "Candidate name is required." };
    }

    const duplicate = candidates.some(candidate =>
        candidate.category_id === categoryId &&
        candidate.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
        return {
            success: false,
            message: "A candidate with that name already exists in this category."
        };
    }

    let parsedPhoto = null;
    if (photo) {
        parsedPhoto = parsePhoto(photo);
        if (!parsedPhoto.success) {
            return parsedPhoto;
        }
    }

    const candidate = {
        id: nextCandidateId++,
        name: cleanName,
        category_id: category.id
    };
    candidates.push(candidate);
    if (parsedPhoto) {
        storePhoto(candidate.id, parsedPhoto);
    }
    return { success: true, candidate: getCandidates().find(item => item.id === candidate.id) };
}

function updateCandidate(id, changes) {
    const candidate = candidates.find(item => item.id === id);
    if (!candidate) {
        return { success: false, status: 404, message: "Candidate not found." };
    }

    const nextName = changes.name === undefined ? candidate.name : String(changes.name).trim();
    if (!nextName) {
        return { success: false, message: "Candidate name is required." };
    }

    const nextCategoryId = changes.categoryId === undefined ? candidate.category_id : changes.categoryId;
    if (!categories.some(item => item.id === nextCategoryId)) {
        return { success: false, message: "Select a valid category." };
    }

    const voteCount = votes.filter(vote => vote.candidate_id === id).length;
    if (nextCategoryId !== candidate.category_id && voteCount > 0) {
        return {
            success: false,
            message: "The office cannot be changed after a candidate has received votes."
        };
    }

    const duplicate = candidates.some(item =>
        item.id !== id &&
        item.category_id === nextCategoryId &&
        item.name.toLowerCase() === nextName.toLowerCase()
    );
    if (duplicate) {
        return {
            success: false,
            message: "A candidate with that name already exists in this category."
        };
    }

    let parsedPhoto = null;
    if (changes.photo) {
        parsedPhoto = parsePhoto(changes.photo);
        if (!parsedPhoto.success) {
            return parsedPhoto;
        }
    }

    candidate.name = nextName;
    candidate.category_id = nextCategoryId;
    if (parsedPhoto) {
        storePhoto(id, parsedPhoto);
    } else if (changes.removePhoto) {
        photos.delete(id);
    }
    return { success: true, candidate: getCandidates().find(item => item.id === id) };
}

function removeCandidate(id) {
    const index = candidates.findIndex(item => item.id === id);
    if (index === -1) {
        return { success: false, status: 404, message: "Candidate not found." };
    }

    candidates.splice(index, 1);
    for (let i = votes.length - 1; i >= 0; i--) {
        if (votes[i].candidate_id === id) votes.splice(i, 1);
    }
    photos.delete(id);
    return { success: true };
}

module.exports = {
    categories,
    getCandidates,
    submitBallot,
    addCandidate,
    updateCandidate,
    removeCandidate,
    getPhoto,
    getTotalVotes: () => votes.length
};
