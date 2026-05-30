(async () => {
    const { fork } = await import("child_process");
    const { WebSocketServer } = await import("ws");
    const { pack, unpack } = await import("msgpackr");
    const http = await import("http");

    const PROXIES = ["http://budget-v6.whiteproxies.com:27020"];
    const prod = false;

    const server = http.createServer((req, res) => {
        res.writeHead(426, { "Content-Type": "text/plain" });
        res.end("lll elk ez big fat noob");
    });

    function randint(a, b) {
        return Math.floor(Math.random() * (b - a + 1)) + a;
    }

    const sessions = new Map();
    const wss = new WebSocketServer({ server });

    wss.on("connection", (ws, req) => {
        const addr = req.socket.remoteAddress;
        console.log(addr, "connected");

        if (!sessions.has(addr)) {
            sessions.set(addr, {
                workers: [],
                tank: "auto6",
                tanks: [],
                tankIdx: 0,
                proxyIdx: 0
            });
        }
        const session = sessions.get(addr);

        let challenge;
        let verified = false;

        function packet(...args) {
            ws.send(pack(args));
        }

        function close() {
            ws.close();
        }

        ws.on("message", (msg) => {
            try {
                const data = unpack(msg);
                const type = data.shift();

                switch (type) {
                    case "M":
                        if (challenge || data[0] != 72011) {
                            close();
                        }
                        challenge = randint(0b1000000000, 0b1111111111);
                        packet("M", challenge);
                        break;

                    case "C":
                        if (data[0] == (challenge ^ 845)) {
                            verified = true;
                            console.log(addr, "verified");
                        } else {
                            close();
                            console.log(addr, "true noob");
                        }
                        break;

                    case "Z":
                        session.tank = data[0];
                        if (session.tank instanceof Array) {
                            session.tanks = session.tank;
                            session.tankIdx = 0;

                            for (const worker of session.workers) {
                                let t = session.tanks[session.tankIdx];
                                worker.send({ type: "tankselect", tank: t });

                                session.tankIdx++;
                                if (session.tankIdx >= session.tanks.length) {
                                    session.tankIdx = 0;
                                }
                            }
                        } else {
                            session.tanks = [];
                            for (const worker of session.workers) {
                                worker.send({ type: "tankselect", tank: session.tank });
                            }
                        }
                        break;

                    case "F":
                        if (verified) {
                            const hash = data[0];
                            const count = parseInt(data[1]) || 1;
                            
                            const clanTag = data[2] || "[kaka]"; 
                            
                            // LẤY BIẾN TỰ ĐỘNG HỒI SINH (NẾU KHÔNG CÓ THÌ MẶC ĐỊNH LÀ TRUE)
                            const autoRespawn = data[3] !== undefined ? data[3] : true;

                            console.log(`Spawning ${count} bots | Name: ${clanTag} | Respawn: ${autoRespawn}`);

                            for (let i = 0; i < count; i++) {
                                setTimeout(() => {
                                    if (session.proxyIdx >= PROXIES.length) {
                                        session.proxyIdx = 0;
                                    }

                                    const worker = fork("index.js", []);
                                    session.workers.push(worker);

                                    if (session.tanks.length) {
                                        worker.send({ type: "tankselect", tank: session.tanks[session.tankIdx] });
                                        session.tankIdx++;
                                        if (session.tankIdx >= session.tanks.length) {
                                            session.tankIdx = 0;
                                        }
                                    } else {
                                        worker.send({ type: "tankselect", tank: session.tank });
                                    }

                                    worker.send({
                                        type: "start", config: {
                                            id: i,
                                            proxy: {
                                                type: "http",
                                                url: PROXIES[session.proxyIdx]
                                            },
                                            hash: "#" + hash,
                                            name: clanTag, 
                                            stats: [0, 0, 0, 0, 0, 0, 0, 9],
                                            type: "follow",
                                            token: "follow-8fe6ca",
                                            autoFire: false,
                                            
                                            // ÁP DỤNG BIẾN AUTORESPAWN VÀO LÕI BOT
                                            autoRespawn: autoRespawn, 
                                            
                                            keys: [],
                                            keysHold: [],
                                            tank: "Auto4",
                                            chatSpam: "",
                                            squadId: hash,
                                            reconnectAttempts: 3,
                                            reconnectDelay: 15000,
                                        }
                                    });

                                    session.proxyIdx++;
                                }, i * 200);
                            }
                        }
                        break;

                    case "B":
                        if (verified) {
                            for (const worker of session.workers) {
                                worker.send({ type: "destroy" });
                            }
                            session.workers = [];
                        }
                        break;

                    case "A":
                        if (verified) {
                            for (const worker of session.workers) {
                                worker.send({
                                    type: "position",
                                    x: data[0],
                                    y: data[1],
                                    mouseX: data[2],
                                    mouseY: data[3],
                                    mouseDown: data[4],
                                    
                                    // BÊN DƯỚI LÀ CHUỘT PHẢI VÀ SHIFT. CHÚNG ĐƯỢC CHUYỂN SANG BOT ĐỂ DÙNG KAMIKAZE
                                    rMouseDown: data[5], 
                                    mouse: data[6],
                                    feeding: data[7],
                                    shift: data[8], 
                                    
                                    autofire: data[9],
                                    autospin: data[10],
                                    manualMode: data[11],
                                    manualX: data[12],
                                    manualY: data[13]
                                });
                            }
                        }
                        break;

                    case "T":
                        if (verified) {
                            for (const worker of session.workers) {
                                worker.send({
                                    type: "chat",
                                    message: data[0],
                                    spam: data[1]
                                });
                            }
                        }
                        break;

                    default:
                        close();
                        break;
                }
            } catch (e) {
                console.error(e);
            }
        });

        ws.on("close", () => {
            console.log(addr, "disconnected (session retained)");
        });
    });

    const port = prod ? process.env.PORT : 8082;
    server.listen(port, () => {
        console.log("Server listening on port", port);
    });
})();