
const socket = io();

const candidateList = document.getElementById("candidateList");
const voterIdInput = document.getElementById("voterId");
const voteButton = document.getElementById("voteButton");
const message = document.getElementById("message");

let selectedCandidate = null;

// Display candidates
async function loadCandidates() {
    try {
        const response = await fetch("/api/candidates");

        if (!response.ok) {
            throw new Error("Failed to load candidates");
        }

        const candidates = await response.json();

        candidateList.innerHTML = "";

        candidates.forEach(candidate => {
            const card = document.createElement("div");
            card.className = "candidate-card";

            const name = document.createElement("h3");
            name.textContent = candidate.name;

            const description = document.createElement("p");
            description.textContent = "Candidate for election";

            const selectButton = document.createElement("button");
            selectButton.textContent = "Select Candidate";
            selectButton.className = "select-button";

            selectButton.addEventListener("click", () => {
                selectedCandidate = candidate.id;

                document.querySelectorAll(".candidate-card")
                    .forEach(item => item.classList.remove("selected"));

                card.classList.add("selected");

                voteButton.disabled = false;
            });

            card.append(name, description, selectButton);
            candidateList.appendChild(card);
        });

        console.log("Candidates loaded:", candidates);

    } catch (error) {
        console.error(error);
        candidateList.textContent = "Unable to load candidates.";
    }
}

// Receive real-time updates
socket.on("vote:updated", (data) => {
    console.log("Received updated candidates:", data.candidates);
    loadCandidates();
});

// Submit vote
voteButton.addEventListener("click", async () => {
    const voterId = voterIdInput.value.trim();

    if (!voterId || selectedCandidate === null) {
        message.textContent = "Enter your ID and select a candidate.";
        return;
    }

    voteButton.disabled = true;

    try {
        const response = await fetch("/api/vote", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                voterId,
                candidateId: selectedCandidate
            })
        });

        const result = await response.json();

        message.textContent = result.message;
        message.className = result.success ? "success" : "error";

        if (result.success) {
            voterIdInput.value = "";
            selectedCandidate = null;
            await loadCandidates();
        }

    } catch (error) {
        message.textContent = "Unable to submit vote.";
        message.className = "error";
    } finally {
        voteButton.disabled = false;
    }
});

// Initial loading
loadCandidates();
