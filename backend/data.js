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

function getCandidates() {
    return candidates.map(candidate => ({
        ...candidate,
        votes: votes.filter(vote => vote.candidate_id === candidate.id).length
    }));
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

function addCandidate(name, categoryId) {
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

    const candidate = {
        id: nextCandidateId++,
        name: cleanName,
        category_id: category.id
    };
    candidates.push(candidate);
    return { success: true, candidate };
}

module.exports = {
    categories,
    getCandidates,
    submitBallot,
    addCandidate,
    getTotalVotes: () => votes.length
};
