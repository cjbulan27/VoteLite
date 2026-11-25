const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const data = require("./data");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "2mb" }));
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
    const { name, categoryId, photo } = req.body;
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

    if (photo !== undefined && photo !== null && typeof photo !== "string") {
        return res.status(400).json({
            success: false,
            message: "The photo must be a JPG, PNG or WebP image."
        });
    }

    const result = data.addCandidate(name, categoryId, photo);
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

app.get("/api/candidates/:id/photo", (req, res) => {
    const photo = data.getPhoto(Number(req.params.id));
    if (!photo) {
        return res.status(404).end();
    }
    res.set("Content-Type", photo.mime);
    res.set("Cache-Control", "public, max-age=86400");
    return res.send(photo.buffer);
});

app.put("/api/candidates/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ success: false, message: "Invalid candidate." });
    }

    const { name, categoryId, photo, removePhoto } = req.body || {};
    if ((name !== undefined && typeof name !== "string") ||
        (categoryId !== undefined && typeof categoryId !== "string") ||
        (photo !== undefined && photo !== null && typeof photo !== "string")) {
        return res.status(400).json({ success: false, message: "Invalid candidate details." });
    }

    const result = data.updateCandidate(id, { name, categoryId, photo, removePhoto: removePhoto === true });
    if (!result.success) {
        return res.status(result.status || 400).json(result);
    }

    io.emit("vote:updated", getResults());
    return res.json({
        success: true,
        message: "Candidate updated.",
        candidate: result.candidate
    });
});

app.delete("/api/candidates/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ success: false, message: "Invalid candidate." });
    }

    const result = data.removeCandidate(id);
    if (!result.success) {
        return res.status(result.status || 400).json(result);
    }

    io.emit("vote:updated", getResults());
    return res.json({ success: true, message: "Candidate removed." });
});

app.use((error, req, res, next) => {
    if (error.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            message: "The photo is too large. Please choose a smaller image."
        });
    }
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ success: false, message: "Invalid request." });
    }
    console.error(error);
    return res.status(500).json({ success: false, message: "Something went wrong." });
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
