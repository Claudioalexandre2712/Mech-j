import sys
from pathlib import Path

# Garante que a raiz do projeto fique no PATH para imports
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from servidor import app

if __name__ == "__main__":
    app.run()
