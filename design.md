I have a repo named "scrambler". I want to build this to be functionally a new website.

The overall goal is to create a large grid. The grid should have columns like [Scramble Algorithm, Scramble Visualizatoin (image), # Turns Required, Solution Algorithm, Solution Cross Color, Solution Pair Color]. It should also allow the user to pick any subset of these, and also create their own columns with custom names (those will always have empty in their rows).

This website should implement its own Rubik's Cube scrambler/solver. It will generate random scrambles, and then calculate the total number of turns (in half-turn-metric) to solve the cross. It should say the full cross solution. It should saywhat color the optimal cross is on. Finally, if the user picks "x-cross" mode, it should tell what first F2L pair the solver chose to use.

There will be several options. It should have a feature for the user to choose a specific starting cross color, or a specific F2L pair for X-Cross. (So, a user could have the solver only find optimal white cross with Blue/Red F2L Pair.

It should also have options on how far the solver should solve. By default, it should find the optimal X-Cross. It should also support only finding Cross. It should also support finding optimal 2x2 block (two cross edges and the corresponding f2l pair between them). This should also have a feature for XX-Cross (Cross with 2 F2L pairs). That one should have an option for any 2 pairs, or 2 adjacent pairs, or 2 diagonal pairs.

There should be a feature so that the user chooses a lower and upper bound, and the solver only keeps solves between that many turns.

There should be no API for this. All the scramble generation logic should be run on the website in the user's browser.

There shoud be an easy button to make the generated table a nice printout.

The table should default to having 20 scrambles, sorted by the total number of moves.

Make sure the code is highly performant, and has tests for correctness and performance.
