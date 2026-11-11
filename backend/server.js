
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));
app.get("/", (req, res) => {
    res.redirect("/voter.html")
});

// Temporary voting data
let candidates = [
    { id: 1, name: "Candidate A", votes: 0 },
    { id: 2, name: "Candidate B", votes: 0 },
    { id: 3, name: "Candidate C", votes: 0 }
];

const voters = new Set();

// Calculate total votes
function getTotalVotes() {
    return candidates.reduce(
        (total, candidate) => total + candidate.votes,
        0
    );
}

// GET: Retrieve candidates and results
app.get("/api/candidates", (req, res) => {
    res.json(candidates);
});

app.get("/api/results", (req, res) => {
    res.json({
        candidates,
        totalVotes: getTotalVotes()
    });
});

// POST: Submit a vote
app.post("/api/vote", (req, res) => {
    const { voterId, candidateId } = req.body;

    if (!voterId || !candidateId) {
        return res.status(400).json({
            success: false,
            message: "Voter ID and candidate are required."
        });
    }

    const id = voterId.trim().toLowerCase();

    if (voters.has(id)) {
        return res.status(400).json({
            success: false,
            message: "You have already voted."
        });
    }

    const candidate = candidates.find(
        c => c.id === Number(candidateId)
    );

    if (!candidate) {
        return res.status(400).json({
            success: false,
            message: "Invalid candidate."
        });
    }

    // Process vote
    candidate.votes++;
    voters.add(id);

    const data = {
        candidates,
        totalVotes: getTotalVotes()
    };

    // Broadcast updated results
    io.emit("vote:updated", data);

    res.json({
        success: true,
        message: "Your vote was submitted successfully!"
    });
});


// POST: Add a new candidate
app.post("/api/candidates", (req, res) => {
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({
            success: false,
            message: "Candidate name is required."
        });
    }

    const candidateName = name.trim();

    // Prevent duplicate candidate names
    const exists = candidates.some(
        candidate =>
            candidate.name.toLowerCase() === candidateName.toLowerCase()
    );

    if (exists) {
        return res.status(400).json({
            success: false,
            message: "Candidate already exists."
        });
    }

    const newCandidate = {
        id: candidates.length > 0
            ? Math.max(...candidates.map(c => c.id)) + 1
            : 1,
        name: candidateName,
        votes: 0
    };

    candidates.push(newCandidate);

    // Broadcast updated candidate list and results
    io.emit("vote:updated", {
        candidates,
        totalVotes: getTotalVotes()
    });

    res.status(201).json({
        success: true,
        message: "Candidate added successfully!",
        candidate: newCandidate
    });
});

// Send current results to newly connected clients
io.on("connection", socket => {
    console.log("Client connected:", socket.id);

    socket.emit("vote:updated", {
        candidates,
        totalVotes: getTotalVotes()
    });
});

server.listen(5000, () => {
    console.log("Voting system running on http://localhost:5000");
});
