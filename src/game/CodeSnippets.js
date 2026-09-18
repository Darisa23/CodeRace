// Real C++ Code Snippets divided into sets of 5 blocks per race
// Versión con bloques cortos (más ágiles para la carrera)

export const CPP_RACE_SETS = [
  {
    id: "set_modern_cpp",
    title: "C++ Moderno: Lambdas & STL",
    blocks: [
      {
        id: 1,
        title: "Vector Initialization",
        code: `std::vector<int> scores = {95, 82, 100, 74, 91};`
      },
      {
        id: 2,
        title: "std::sort con Lambda",
        code: `std::sort(scores.begin(), scores.end(), [](int a, int b) {
    return a > b;
});`
      },
      {
        id: 3,
        title: "std::unique_ptr",
        code: `auto engine = std::make_unique<CarEngine>();
engine->rev();`
      },
      {
        id: 4,
        title: "Función Template",
        code: `template <typename T>
T getMax(T a, T b) {
    return (a > b) ? a : b;
}`
      },
      {
        id: 5,
        title: "Struct básico",
        code: `struct Racer {
    std::string name;
    int wpm;
};`
      }
    ]
  },
  {
    id: "set_oop_cpp",
    title: "C++ Orientado a Objetos: Clases y Herencia",
    blocks: [
      {
        id: 1,
        title: "Clase Vehicle",
        code: `class Vehicle {
protected:
    int speed;
};`
      },
      {
        id: 2,
        title: "Herencia",
        code: `class RaceCar : public Vehicle {
    bool nitroActive;
};`
      },
      {
        id: 3,
        title: "Manejo de Excepciones",
        code: `try {
    throw std::overflow_error("Velocidad critica!");
} catch (const std::exception& e) {}`
      },
      {
        id: 4,
        title: "Operador Sobrecargado",
        code: `Vector2D operator+(const Vector2D& other) const {
    return {x + other.x, y + other.y};
}`
      },
      {
        id: 5,
        title: "Move Semantics",
        code: `std::string report = std::move(telemetry);`
      }
    ]
  }
];

export function getRandomSnippetSet() {
  const index = Math.floor(Math.random() * CPP_RACE_SETS.length);
  return CPP_RACE_SETS[index];
}
