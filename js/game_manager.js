function GameManager(size, InputManager, Actuator, StorageManager) {
  this.size           = size; // Size of the grid
  this.inputManager   = new InputManager;
  this.storageManager = new StorageManager;
  this.actuator       = new Actuator;

  this.startTiles     = 2;
  this.difficulty     = "hard";

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));
  this.inputManager.on("keepPlaying", this.keepPlaying.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.storageManager.clearGameState();
  this.actuator.continueGame(); // Clear the game won/lost message
  this.setup();
};

// Keep playing after winning (allows going over 2048)
GameManager.prototype.keepPlaying = function () {
  this.keepPlaying = true;
  this.actuator.continueGame(); // Clear the game won/lost message
};

// Return true if the game is lost, or has won and the user hasn't kept playing
GameManager.prototype.isGameTerminated = function () {
  return this.over || (this.won && !this.keepPlaying);
};

// Set up the game
GameManager.prototype.setup = function () {
  var previousState = this.storageManager.getGameState();

  // Reload the game from a previous game if present
  if (previousState) {
    this.grid        = new Grid(previousState.grid.size,
                                previousState.grid.cells); // Reload grid
    this.score       = previousState.score;
    this.over        = previousState.over;
    this.won         = previousState.won;
    this.keepPlaying = previousState.keepPlaying;
  } else {
    this.grid        = new Grid(this.size);
    this.score       = 0;
    this.over        = false;
    this.won         = false;
    this.keepPlaying = false;

    // Add the initial tiles
    this.addStartTiles();
  }

  // Update the actuator
  this.actuate();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    this.addRandomTile();
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile;
    switch(this.difficulty) {
      case "easy":
      case "hard":
        var ratingList = this.getSortedRatingList(value);
	if (this.difficulty == "easy") {
	  tile = new Tile(ratingList[0].cell, value);
	} else {
	  tile = new Tile(ratingList[ratingList.length - 1].cell, value);
	}
	break;

      default:
      case "medium":
        tile = new Tile(this.grid.randomAvailableCell(), value);
	break;
    }

    this.grid.insertTile(tile);
  }
};

GameManager.prototype.getSortedRatingList = function (value) {
  var cells = this.grid.availableCells();
  var cellRatings = [];
  cells.forEach(function(cell) {
    var lowestScore = 1000000;
    var highestScore = 0;
    var availableDirections = 0;
    for (var dir = 0; dir < 4; dir++) {
      var tempGrid = new Grid(this.grid.size, this.grid.cells);
      var tile = new Tile(cell, value);
      tempGrid.insertTile(tile);
      var result = tempGrid.move(dir);
      if (result.moved) {
        availableDirections++;
	lowestScore = Math.min(lowestScore, result.score);
	highestScore = Math.max(highestScore, result.score);
      }
    }

    cellRatings.push({
      cell: cell,
      lowestScore: lowestScore,
      highestScore: highestScore,
      directions: availableDirections,
      random: Math.random()  // Last comparison -- just pick random position
    });
  }, this);

  cellRatings.sort(function(a, b) {
    if (a.directions > b.directions) return -1;
    if (a.directions < b.directions) return 1;
    if (a.highestScore > b.highestScore) return -1;
    if (a.highestScore < b.highestScore) return 1;
    if (a.random > b.random) return -1;
    if (a.random < b.random) return 1;
    return 0;
  });

  return cellRatings;
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  if (this.storageManager.getBestScore() < this.score) {
    this.storageManager.setBestScore(this.score);
  }

  // Clear the state when the game is over (game over only, not win)
  if (this.over) {
    this.storageManager.clearGameState();
  } else {
    this.storageManager.setGameState(this.serialize());
  }

  this.actuator.actuate(this.grid, {
    score:      this.score,
    over:       this.over,
    won:        this.won,
    bestScore:  this.storageManager.getBestScore(),
    terminated: this.isGameTerminated()
  });

};

// Represent the current game as an object
GameManager.prototype.serialize = function () {
  return {
    grid:        this.grid.serialize(),
    score:       this.score,
    over:        this.over,
    won:         this.won,
    keepPlaying: this.keepPlaying
  };
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.isGameTerminated()) return; // Don't do anything if the game's over

  var result = this.grid.move(direction);

  this.score += result.score;
  this.won = result.won;

  if (result.moved) {
    this.addRandomTile();

    if (!this.grid.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
  }
};
