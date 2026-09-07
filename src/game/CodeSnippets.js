// Real C++ Code Snippets divided into sets of 5 blocks per race

export const CPP_RACE_SETS = [
  {
    id: "set_modern_cpp",
    title: "C++ Moderno: Lambdas & STL",
    blocks: [
      {
        id: 1,
        title: "Encabezados y Vector Initialization",
        code: `#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> scores = {95, 82, 100, 74, 91};
    return 0;
}`
      },
      {
        id: 2,
        title: "Algoritmo std::sort y Lambda Expression",
        code: `std::sort(scores.begin(), scores.end(), [](int a, int b) {
    return a > b;
});
for (int score : scores) {
    std::cout << score << " ";
}`
      },
      {
        id: 3,
        title: "Punteros Inteligentes std::unique_ptr",
        code: `#include <memory>

class CarEngine {
public:
    void rev() { std::cout << "VROOM!\\n"; }
};

auto engine = std::make_unique<CarEngine>();
engine->rev();`
      },
      {
        id: 4,
        title: "Plantilla de Función (Templates)",
        code: `template <typename T>
T getMax(T a, T b) {
    return (a > b) ? a : b;
}

int topSpeed = getMax(240, 280);`
      },
      {
        id: 5,
        title: "Estructuras Struct y Concurrencia Basic",
        code: `struct Racer {
    std::string name;
    int wpm;
    bool finished;
};

Racer player1{"CyberRacer", 110, true};
std::cout << "Meta alcanzada por " << player1.name;`
      }
    ]
  },
  {
    id: "set_oop_cpp",
    title: "C++ Orientado a Objetos: Clases y Herencia",
    blocks: [
      {
        id: 1,
        title: "Definición de Clase Vehicle",
        code: `class Vehicle {
protected:
    int speed;
public:
    Vehicle(int s) : speed(s) {}
    virtual void accelerate(int boost) {
        speed += boost;
    }
};`
      },
      {
        id: 2,
        title: "Herencia y Sobrescritura Virtual",
        code: `class RaceCar : public Vehicle {
private:
    bool nitroActive;
public:
    RaceCar(int s) : Vehicle(s), nitroActive(false) {}
    void triggerNitro() { nitroActive = true; speed *= 2; }
};`
      },
      {
        id: 3,
        title: "Manejo de Excepciones std::exception",
        code: `try {
    if (speed > 350) {
        throw std::overflow_error("Velocidad critica!");
    }
} catch (const std::exception& e) {
    std::cerr << e.what() << '\\n';
}`
      },
      {
        id: 4,
        title: "Operadores Sobrecargados",
        code: `struct Vector2D {
    float x, y;
    Vector2D operator+(const Vector2D& other) const {
        return {x + other.x, y + other.y};
    }
};`
      },
      {
        id: 5,
        title: "Move Semantics & std::move",
        code: `#include <utility>

std::string telemetry = "WPM:125, ACC:99%";
std::string report = std::move(telemetry);
std::cout << "Reporte final: " << report;`
      }
    ]
  }
];

export function getRandomSnippetSet() {
  const index = Math.floor(Math.random() * CPP_RACE_SETS.length);
  return CPP_RACE_SETS[index];
}
