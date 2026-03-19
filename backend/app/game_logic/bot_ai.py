"""Simple rule-based AI for game bots."""
import random


def get_dice_ai_decision(engine, player_id: str) -> dict:
    """
    Simple AI for dice mode.
    Returns: {"action": "place_bid" or "challenge_bid", "data": {...}}
    """
    # Get current bid
    current_bid = engine.current_bid
    my_dice = engine.dice.get(player_id, [])

    if not current_bid:
        # First bid of the round - make a reasonable initial bid
        # Count my dice
        dice_count = {}
        for d in my_dice:
            dice_count[d] = dice_count.get(d, 0) + 1

        # Find most common face
        best_face = max(dice_count.items(), key=lambda x: x[1])[0]
        best_count = dice_count[best_face]

        # Guess total (rough estimate: my count + others' expected average)
        # Assume 4 players with 5 dice each = 20 dice total
        estimated_total = best_count + 5  # Conservative estimate

        return {
            "action": "place_bid",
            "data": {
                "quantity": estimated_total,
                "face_value": best_face
            }
        }
    else:
        # There is already a bid - decide whether to raise or challenge
        current_qty = current_bid["quantity"]
        current_face = current_bid["face_value"]

        # Count my dice matching current face
        my_match = my_dice.count(current_face)

        # Estimate others have similar distribution
        # If I'm confident, raise; otherwise challenge
        confidence = my_match + random.randint(1, 4)  # Add some randomness

        if confidence >= current_qty - 2:
            # I'm confident, raise the bid
            if current_face < 6:
                new_face = current_face + 1
                new_qty = current_qty
            else:
                new_face = current_face
                new_qty = current_qty + 1

            return {
                "action": "place_bid",
                "data": {
                    "quantity": new_qty,
                    "face_value": new_face
                }
            }
        else:
            # Not confident, challenge
            return {
                "action": "challenge_bid",
                "data": {}
            }


def get_deck_ai_decision(engine, player_id: str) -> dict:
    """
    Simple AI for deck mode.
    Returns: {"action": "play_cards" or "call_liar", "data": {...}}
    """
    # For now, just play a random card
    # TODO: Implement smarter deck AI
    return {
        "action": "play_cards",
        "data": {
            "cards": [0]  # Play first card
        }
    }
