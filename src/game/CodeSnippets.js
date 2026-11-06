// Real Python Code Snippets divided into sets of 5 blocks per race
// Bloques cortos (más ágiles para la carrera). Indentación con 4 espacios.

export const PYTHON_RACE_SETS = [
  {
    id: "set_python_basics",
    title: "Python Esencial: Listas, Lambdas y Comprensiones",
    blocks: [
      {
        id: 1,
        title: "Lista de puntajes",
        code: `scores = [95, 82, 100, 74, 91]`
      },
      {
        id: 2,
        title: "sorted con Lambda",
        code: `ranking = sorted(scores, key=lambda s: s, reverse=True)
print(ranking[:3])`
      },
      {
        id: 3,
        title: "List Comprehension",
        code: `fast = [s for s in scores if s > 90]
print(len(fast))`
      },
      {
        id: 4,
        title: "Función con tipos",
        code: `def get_max(a: int, b: int) -> int:
    return a if a > b else b`
      },
      {
        id: 5,
        title: "Dataclass",
        code: `@dataclass
class Racer:
    name: str
    wpm: int`
      }
    ]
  },
  {
    id: "set_python_oop",
    title: "Python Orientado a Objetos: Clases y Herencia",
    blocks: [
      {
        id: 1,
        title: "Clase Vehicle",
        code: `class Vehicle:
    def __init__(self, speed):
        self.speed = speed`
      },
      {
        id: 2,
        title: "Herencia",
        code: `class RaceCar(Vehicle):
    nitro_active = False`
      },
      {
        id: 3,
        title: "Manejo de Excepciones",
        code: `try:
    raise OverflowError("Velocidad critica!")
except Exception as e:
    print(e)`
      },
      {
        id: 4,
        title: "Operador Sobrecargado",
        code: `def __add__(self, other):
    return Vector2D(self.x + other.x, self.y + other.y)`
      },
      {
        id: 5,
        title: "Diccionario y f-string",
        code: `report = {"racer": "Neo", "wpm": 120}
print(f"{report['racer']}: {report['wpm']}")`
      }
    ]
  }
];

export function getRandomSnippetSet() {
  const index = Math.floor(Math.random() * PYTHON_RACE_SETS.length);
  return PYTHON_RACE_SETS[index];
}
