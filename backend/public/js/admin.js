const socket = io();
const totalVotes = document.getElementById('totalVotes');
const leader = document.getElementById('leader');
const candidatesContainer = document.getElementById('candidates');
const connection = document.getElementById('connection');
const addCandidateForm = document.getElementById('addCandidateForm');
const candidateNameInput = document.getElementById('candidateName');
const candidateMessage = document.getElementById('candidateMessage');
const addCandidateButton = document.getElementById('addCandidateButton');

//Add candidate Functionality
addCandidateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = candidateNameInput.value.trim();
    if (!name) {
        candidateMessage.textContent = "Please enter a candidate name.";
        candidateMessage.className = "error";
        return;
    }

    addCandidateButton.disabled = true;
    try {
        const response = await fetch('/api/candidates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });
        const result = await response.json();
        candidateMessage.textContent = result.message;
        candidateMessage.className = result.success ? "success" : "error";
        if (result.success) {
            candidateNameInput.value = "";
        }
        }catch (error) {
            candidateMessage.textContent = "Unable to add candidates";
            candidateMessage.className = "error";
        }finally {
            addCandidateButton.disabled = false;
        }
    });    
//connection status
socket.on('connect', () => {
    connection.textContent = "Live";
    connection.style.color = "green";
});
socket.on('disconnect', () => {
    connection.textContent = "Disconnected";
    connection.style.color = "red";
});

//Receive real-time voting updates
socket.on('voteUpdate', data => {
    const candidates = data.candidates;
    const total = data.totalVotes;

    totalVotes.textContent = total;
    candidatesContainer.textContent = candidates.length;

    const sorted = [...candidates].sort ((a, b) => b.votes - a.votes);
    
    leader.textContent = total > 0 ? sorted[0].name : "No votes yet";

    candidatesContainer.innerHTML = "";
    candidates.forEach(candidate => {
        const percentage = total > 0 ? ((candidate.votes / total) * 100).toFixed(2) : 0;
        
        const card = document.createElement('div');
        card.className = "result-card";

        const name = document.createElement('h3');
        name.textContent = candidate.name;

        const count = document.createElement('p');
        count.textContent = `${candidate.votes} votes`;

        const bar = document.createElement('div');
        bar.className = "progress-bar";

        const fill = document.createElement ('div');
        fill.className = "progress-fill";
        fill.style.width = `${percentage}%`;

        const percent = document.createElement('p');
        percent.textContent = `${percentage.toFixed(1)}%`;

        bar.appendChild
        card.append(name, count, bar, percent);
        candidatesContainer.appendChild(card);
    });
});