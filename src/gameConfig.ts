export interface BoardPosition {
  row: number;
  col: number;
}

export interface BoardCell {
  id: number;
  label: string;
}

export interface BoardConfig {
  boardCells: BoardCell[];
  boardPositions: BoardPosition[];
  boardSize: number;
  finishIndex: number;
}

export interface PlayerSeed {
  id: "pink" | "mint";
  name: string;
  shortName: string;
  color: string;
}

function createSpiralSnakePositions(cellCount: number): BoardPosition[] {
  const boardSize = Math.ceil(Math.sqrt(Math.max(cellCount, 1)));
  const positions: BoardPosition[] = [];
  let top = 1;
  let right = boardSize;
  let bottom = boardSize;
  let left = 1;

  while (positions.length < cellCount && left <= right && top <= bottom) {
    for (let col = left; col <= right && positions.length < cellCount; col += 1) {
      positions.push({ row: top, col });
    }
    top += 1;

    for (let row = top; row <= bottom && positions.length < cellCount; row += 1) {
      positions.push({ row, col: right });
    }
    right -= 1;

    for (let col = right; col >= left && positions.length < cellCount; col -= 1) {
      positions.push({ row: bottom, col });
    }
    bottom -= 1;

    for (let row = bottom; row >= top && positions.length < cellCount; row -= 1) {
      positions.push({ row, col: left });
    }
    left += 1;
  }

  return positions;
}

export function createBoardConfig(cellCount: number): BoardConfig {
  const boardPositions = createSpiralSnakePositions(Math.max(cellCount, 1));

  return {
    boardCells: boardPositions.map((_, index) => ({
      id: index,
      label: String(index + 1),
    })),
    boardPositions,
    boardSize: Math.ceil(Math.sqrt(Math.max(cellCount, 1))),
    finishIndex: boardPositions.length - 1,
  };
}

export const gameConfig = {
  title: "情侣飞行棋",
  players: [
    {
      id: "pink",
      name: "恋人 A",
      shortName: "A",
      color: "#ff6f91",
    },
    {
      id: "mint",
      name: "恋人 B",
      shortName: "B",
      color: "#36cdb6",
    },
  ] satisfies PlayerSeed[],
};
