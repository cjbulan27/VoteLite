const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const data = require("./data");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.redirect("/voter.html"));

function getResults() {
    return {
        categories: data.categories,
        candidates: data.getCandidates(),
        totalVotes: data.getTotalVotes()
    };
}

app.get("/api/categories", (req, res) => {
    res.json(data.categories);
});

app.get("/api/candidates", (req, res) => {
    res.json(data.getCandidates());
});

app.get("/api/results", (req, res) => {
    res.json(getResults());
});

app.post("/api/vote", (req, res) => {
    const { voterId, candidateIds } = req.body;
    if (typeof voterId !== "string" || !voterId.trim()) {
        return res.status(400).json({
            success: false,
            message: "Voter ID is required."
        });
    }

    const result = data.submitBallot(voterId, candidateIds);
    if (!result.success) {
        return res.status(400).json(result);
    }

    const results = getResults();
    io.emit("vote:updated", results);
    return res.json({
        success: true,
        message: "Your ballot was submitted successfully!"
    });
});

app.post("/api/candidates", (req, res) => {
    const { name, categoryId } = req.body;
    if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
            success: false,
            message: "Candidate name is required."
        });
    }
    if (typeof categoryId !== "string" || !categoryId) {
        return res.status(400).json({
            success: false,
            message: "Category is required."
        });
    }

    const result = data.addCandidate(name, categoryId);
    if (!result.success) {
        return res.status(400).json(result);
    }

    io.emit("vote:updated", getResults());
    return res.status(201).json({
        success: true,
        message: "Candidate added successfully.",
        candidate: result.candidate
    });
});

io.on("connection", socket => {
    socket.emit("vote:updated", getResults());
});

const defaultPort = Number(process.env.PORT) || 5000;

function startServer(portToUse) {
    server.once("error", error => {
        if (error.code === "EADDRINUSE") {
            const nextPort = portToUse + 1;
            console.warn(`Port ${portToUse} is in use. Retrying on ${nextPort}...`);
            startServer(nextPort);
            return;
        }
        throw error;
    });

    server.listen(portToUse, () => {
        console.log(`Voting system running on http://localhost:${portToUse}`);
    });
}

startServer(defaultPort);
