from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
import math
from typing import List

app = FastAPI(title="BTS Optimizer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── MODEL DATA ──
class Config(BaseModel):
    area_width: int = 1000
    area_height: int = 1000
    num_penduduk: int = 100
    num_menara: int = 5
    radius_coverage: float = 150.0
    biaya_per_menara: float = 1000.0
    mode: str = "coverage"
    hc_variant: str = "steepest"
    hc_max_iter: int = 500
    sa_suhu_awal: float = 1000.0
    sa_cooling_rate: float = 0.995
    sa_suhu_min: float = 0.1
    ga_populasi: int = 50
    ga_generasi: int = 100
    ga_crossover: float = 0.8
    ga_mutasi: float = 0.1

# ── GENERATE PENDUDUK ACAK ──
def generate_penduduk(n, w, h):
    return [{"x": random.randint(0, w), "y": random.randint(0, h)} for _ in range(n)]

# ── HITUNG FITNESS ──
def hitung_fitness(menara, penduduk, radius, biaya_per_menara, mode):
    covered = set()
    for i, p in enumerate(penduduk):
        for m in menara:
            dist = math.sqrt((p["x"] - m["x"])**2 + (p["y"] - m["y"])**2)
            if dist <= radius:
                covered.add(i)
                break

    coverage = len(covered) / len(penduduk)
    total_biaya = len(menara) * biaya_per_menara

    overlap = 0
    for i in range(len(menara)):
        for j in range(i+1, len(menara)):
            dist = math.sqrt((menara[i]["x"]-menara[j]["x"])**2 + (menara[i]["y"]-menara[j]["y"])**2)
            if dist < radius * 2:
                overlap += 1

    if mode == "coverage":
        return coverage
    elif mode == "minimize":
        return coverage - (len(menara) * 0.05)
    elif mode == "cost":
        return coverage - (total_biaya / 100000) - (overlap * 0.02)

# ── GENERATE SOLUSI AWAL ──
def random_solution(num_menara, w, h):
    return [{"x": random.randint(0, w), "y": random.randint(0, h)} for _ in range(num_menara)]

# ── HILL CLIMBING ──
def hill_climbing(config: Config, penduduk):
    current = random_solution(config.num_menara, config.area_width, config.area_height)
    current_fit = hitung_fitness(current, penduduk, config.radius_coverage, config.biaya_per_menara, config.mode)
    history = [{"iterasi": 0, "fitness": round(current_fit, 4)}]
    step = 30

    for i in range(1, config.hc_max_iter + 1):
        if config.hc_variant == "stochastic":
            idx = random.randint(0, len(current) - 1)
            neighbor = [m.copy() for m in current]
            neighbor[idx]["x"] = max(0, min(config.area_width,  neighbor[idx]["x"] + random.randint(-step, step)))
            neighbor[idx]["y"] = max(0, min(config.area_height, neighbor[idx]["y"] + random.randint(-step, step)))
            neighbors = [neighbor]
        else:
            neighbors = []
            for idx in range(len(current)):
                for dx, dy in [(step,0),(-step,0),(0,step),(0,-step)]:
                    n = [m.copy() for m in current]
                    n[idx]["x"] = max(0, min(config.area_width,  n[idx]["x"] + dx))
                    n[idx]["y"] = max(0, min(config.area_height, n[idx]["y"] + dy))
                    neighbors.append(n)

        if config.hc_variant == "steepest":
            best_n = max(neighbors, key=lambda n: hitung_fitness(n, penduduk, config.radius_coverage, config.biaya_per_menara, config.mode))
            best_fit = hitung_fitness(best_n, penduduk, config.radius_coverage, config.biaya_per_menara, config.mode)
            if best_fit > current_fit:
                current, current_fit = best_n, best_fit
        else:
            for n in neighbors:
                fit = hitung_fitness(n, penduduk, config.radius_coverage, config.biaya_per_menara, config.mode)
                if fit > current_fit:
                    current, current_fit = n, fit
                    break

        if i % 10 == 0:
            history.append({"iterasi": i, "fitness": round(current_fit, 4)})

    return current, current_fit, history

# ── SIMULATED ANNEALING ──
def simulated_annealing(config: Config, penduduk):
    current = random_solution(config.num_menara, config.area_width, config.area_height)
    current_fit = hitung_fitness(current, penduduk, config.radius_coverage, config.biaya_per_menara, config.mode)
    best, best_fit = [m.copy() for m in current], current_fit
    T = config.sa_suhu_awal
    history = []
    step = 50
    iterasi = 0

    while T > config.sa_suhu_min:
        neighbor = [m.copy() for m in current]
        idx = random.randint(0, len(neighbor) - 1)
        neighbor[idx]["x"] = max(0, min(config.area_width,  neighbor[idx]["x"] + random.randint(-step, step)))
        neighbor[idx]["y"] = max(0, min(config.area_height, neighbor[idx]["y"] + random.randint(-step, step)))

        neighbor_fit = hitung_fitness(neighbor, penduduk, config.radius_coverage, config.biaya_per_menara, config.mode)
        delta = neighbor_fit - current_fit

        if delta > 0 or random.random() < math.exp(delta / T):
            current, current_fit = neighbor, neighbor_fit

        if current_fit > best_fit:
            best, best_fit = [m.copy() for m in current], current_fit

        T *= config.sa_cooling_rate
        iterasi += 1

        if iterasi % 100 == 0:
            history.append({"iterasi": iterasi, "fitness": round(best_fit, 4), "suhu": round(T, 4)})

    return best, best_fit, history

# ── GENETIC ALGORITHM ──
def genetic_algorithm(config: Config, penduduk):
    def fitness(sol):
        return hitung_fitness(sol, penduduk, config.radius_coverage, config.biaya_per_menara, config.mode)

    populasi = [random_solution(config.num_menara, config.area_width, config.area_height)
                for _ in range(config.ga_populasi)]
    history = []
    best, best_fit = None, -999

    for gen in range(config.ga_generasi):
        scored = sorted(populasi, key=fitness, reverse=True)
        if fitness(scored[0]) > best_fit:
            best, best_fit = scored[0], fitness(scored[0])

        new_pop = scored[:2]

        while len(new_pop) < config.ga_populasi:
            p1 = max(random.sample(populasi, 3), key=fitness)
            p2 = max(random.sample(populasi, 3), key=fitness)

            if random.random() < config.ga_crossover:
                cut = random.randint(1, config.num_menara - 1)
                child = p1[:cut] + p2[cut:]
            else:
                child = [m.copy() for m in p1]

            if random.random() < config.ga_mutasi:
                idx = random.randint(0, len(child) - 1)
                child[idx] = {"x": random.randint(0, config.area_width),
                              "y": random.randint(0, config.area_height)}

            new_pop.append(child)

        populasi = new_pop
        if gen % 10 == 0:
            history.append({"generasi": gen, "fitness": round(best_fit, 4)})

    return best, best_fit, history

# ── ENDPOINTS ──
@app.get("/api/test")
def test():
    return {"status": "ok", "message": "BTS Optimizer API berjalan!"}

# ── ENDPOINT HILL CLIMBING ──
@app.post("/api/hill-climbing")
def run_hill_climbing(config: Config):
    random.seed()
    penduduk = generate_penduduk(config.num_penduduk, config.area_width, config.area_height)
    menara, fitness, history = hill_climbing(config, penduduk)
    return {
        "algoritma": "Hill Climbing",
        "varian": config.hc_variant,
        "mode": config.mode,
        "menara": menara,
        "penduduk": penduduk,
        "fitness": round(fitness, 4),
        "coverage_persen": round(fitness * 100, 2),
        "history": history,
    }

# ── ENDPOINT SIMULATED ANNEALING ──
@app.post("/api/simulated-annealing")
def run_simulated_annealing(config: Config):
    random.seed()
    penduduk = generate_penduduk(config.num_penduduk, config.area_width, config.area_height)
    menara, fitness, history = simulated_annealing(config, penduduk)
    return {
        "algoritma": "Simulated Annealing",
        "mode": config.mode,
        "menara": menara,
        "penduduk": penduduk,
        "fitness": round(fitness, 4),
        "coverage_persen": round(fitness * 100, 2),
        "history": history,
    }

# ── ENDPOINT GENETIC ALGORITHM ──
@app.post("/api/genetic-algorithm")
def run_genetic_algorithm(config: Config):
    random.seed()
    penduduk = generate_penduduk(config.num_penduduk, config.area_width, config.area_height)
    menara, fitness, history = genetic_algorithm(config, penduduk)
    return {
        "algoritma": "Genetic Algorithm",
        "mode": config.mode,
        "menara": menara,
        "penduduk": penduduk,
        "fitness": round(fitness, 4),
        "coverage_persen": round(fitness * 100, 2),
        "history": history,
    }

# ── ENDPOINT KOMPARASI ──
@app.post("/api/compare")
def run_compare(config: Config):
    random.seed()
    penduduk = generate_penduduk(config.num_penduduk, config.area_width, config.area_height)

    menara_hc, fit_hc, history_hc = hill_climbing(config, penduduk)
    menara_sa, fit_sa, history_sa = simulated_annealing(config, penduduk)
    menara_ga, fit_ga, history_ga = genetic_algorithm(config, penduduk)

    return {
        "penduduk": penduduk,
        "hill_climbing": {
            "menara": menara_hc, "fitness": round(fit_hc, 4),
            "coverage_persen": round(fit_hc * 100, 2), "history": history_hc
        },
        "simulated_annealing": {
            "menara": menara_sa, "fitness": round(fit_sa, 4),
            "coverage_persen": round(fit_sa * 100, 2), "history": history_sa
        },
        "genetic_algorithm": {
            "menara": menara_ga, "fitness": round(fit_ga, 4),
            "coverage_persen": round(fit_ga * 100, 2), "history": history_ga
        },
        "pemenang": max(
            ["hill_climbing", "simulated_annealing", "genetic_algorithm"],
            key=lambda k: {"hill_climbing": fit_hc, "simulated_annealing": fit_sa, "genetic_algorithm": fit_ga}[k]
        )
    }

app.mount("/static", StaticFiles(directory="frontend/static"), name="static")

@app.get("/")
def serve_index():
    return FileResponse("frontend/index.html")