function buildDefaultLifetimeStats(overrides = {}) {
    return {
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        correct: 0,
        incorrect: 0,
        totalPoints: 0,
        bestScore: 0,
        averageScore: 0,
        fastestCorrectAnswer: null,
        fastestTime: null,
        averageTime: null,
        streakBest: 0,
        booksCompleted: [],
        achievementsUnlocked: [],
        ...overrides
    };
}

function formatStat(value) {
    return Number(value || 0).toFixed(1);
}

function buildDefaultMultiplayerStats(overrides = {}) {
    return buildDefaultLifetimeStats(overrides);
}

function combineProfileStats(singleStats, multiplayerStats) {
    const single = normalizeLifetimeStats(singleStats || {});
    const multiplayer = normalizeLifetimeStats(multiplayerStats || {});
    const gamesPlayed = single.gamesPlayed + multiplayer.gamesPlayed;

    return buildDefaultLifetimeStats({
        gamesPlayed,
        wins: single.wins + multiplayer.wins,
        losses: single.losses + multiplayer.losses,
        correct: single.correct + multiplayer.correct,
        incorrect: single.incorrect + multiplayer.incorrect,
        totalPoints: single.totalPoints + multiplayer.totalPoints,
        bestScore: Math.max(single.bestScore, multiplayer.bestScore),
        averageScore: gamesPlayed > 0
            ? ((single.averageScore * single.gamesPlayed) + (multiplayer.averageScore * multiplayer.gamesPlayed)) / gamesPlayed
            : 0,
        fastestCorrectAnswer: [single.fastestCorrectAnswer, multiplayer.fastestCorrectAnswer]
            .filter(value => value !== null && value !== undefined)
            .reduce((fastest, value) => Math.min(fastest, value), null),
        fastestTime: [single.fastestTime, multiplayer.fastestTime]
            .filter(value => value !== null && value !== undefined)
            .reduce((fastest, value) => Math.min(fastest, value), null),
        averageTime: gamesPlayed > 0
            ? ((single.averageTime || 0) * single.gamesPlayed + (multiplayer.averageTime || 0) * multiplayer.gamesPlayed) / gamesPlayed
            : null,
        streakBest: Math.max(single.streakBest, multiplayer.streakBest),
        booksCompleted: [...new Set([...single.booksCompleted, ...multiplayer.booksCompleted])],
        achievementsUnlocked: [...new Set([...single.achievementsUnlocked, ...multiplayer.achievementsUnlocked])]
    });
}

function normalizeLifetimeStats(raw = {}) {
    return buildDefaultLifetimeStats({
        gamesPlayed: Number(raw.gamesPlayed ?? 0),
        wins: Number(raw.wins ?? 0),
        losses: Number(raw.losses ?? 0),
        correct: Number(raw.correct ?? 0),
        incorrect: Number(raw.incorrect ?? 0),
        totalPoints: Number(raw.totalPoints ?? 0),
        bestScore: Number(raw.bestScore ?? 0),
        averageScore: Number(raw.averageScore ?? 0),
        fastestCorrectAnswer: raw.fastestCorrectAnswer ?? raw.fastestTime ?? null,
        fastestTime: raw.fastestTime ?? null,
        averageTime: raw.averageTime ?? null,
        streakBest: Number(raw.streakBest ?? 0),
        booksCompleted: Array.isArray(raw.booksCompleted) ? raw.booksCompleted : [],
        achievementsUnlocked: Array.isArray(raw.achievementsUnlocked) ? raw.achievementsUnlocked : []
    });
}

async function updateLifetimeStats(profileId, updates) {
    const ref = doc(window.db, "profiles", profileId);
    const current = await getDoc(ref);
    const existing = current.exists() ? (current.data().lifetimeStats || {}) : {};

    const mergedStats = normalizeLifetimeStats({
        ...existing,
        ...updates
    });

    await updateDoc(ref, {
        lifetimeStats: mergedStats,
        updatedAt: Date.now()
    });
}

async function updateMultiplayerStats(profileId, gameStats) {
    const ref = doc(window.db, "profiles", profileId);
    const current = await getDoc(ref);
    const existing = current.exists() ? (current.data().multiplayerStats || {}) : {};
    const previous = normalizeLifetimeStats(existing);
    const previousGames = previous.gamesPlayed;
    const nextGames = previousGames + 1;
    const score = Number(gameStats.totalPoints || 0);

    const mergedStats = normalizeLifetimeStats({
        ...previous,
        gamesPlayed: nextGames,
        wins: previous.wins + Number(gameStats.wins || 0),
        losses: previous.losses + Number(gameStats.losses || 0),
        correct: previous.correct + Number(gameStats.correct || 0),
        incorrect: previous.incorrect + Number(gameStats.incorrect || 0),
        totalPoints: previous.totalPoints + score,
        bestScore: Math.max(previous.bestScore, score),
        averageScore: ((previous.averageScore * previousGames) + score) / nextGames,
        fastestCorrectAnswer: previous.fastestCorrectAnswer === null || previous.fastestCorrectAnswer === undefined
            ? gameStats.fastestCorrectAnswer ?? null
            : gameStats.fastestCorrectAnswer === null || gameStats.fastestCorrectAnswer === undefined
                ? previous.fastestCorrectAnswer
                : Math.min(previous.fastestCorrectAnswer, gameStats.fastestCorrectAnswer),
        fastestTime: previous.fastestTime === null || previous.fastestTime === undefined
            ? gameStats.fastestTime ?? null
            : gameStats.fastestTime === null || gameStats.fastestTime === undefined
                ? previous.fastestTime
                : Math.min(previous.fastestTime, gameStats.fastestTime),
        averageTime: ((previous.averageTime || 0) * previousGames + (gameStats.averageTime || 0)) / nextGames,
        streakBest: Math.max(previous.streakBest, Number(gameStats.streakBest || 0))
    });

    await updateDoc(ref, {
        multiplayerStats: mergedStats,
        updatedAt: Date.now()
    });
}

async function recordLocalMultiplayerStats() {
    const profilePlayers = players.filter(player => player.profileId);
    if (profilePlayers.length === 0) return;

    const highestScore = Math.max(...players.map(player => Number(player.points || 0)));
    await Promise.all(profilePlayers.map(player => updateMultiplayerStats(player.profileId, {
        wins: player.points === highestScore ? 1 : 0,
        losses: player.points === highestScore ? 0 : 1,
        correct: player.correct || 0,
        incorrect: player.incorrect || 0,
        totalPoints: player.points || 0,
        fastestCorrectAnswer: player.fastestTime,
        fastestTime: player.fastestTime,
        averageTime: player.avgTime || 0,
        streakBest: player.bestStreak || 0
    })));
}
