"""Local, landscape-specific writing, also used as a brief for LLM narration."""

MESSAGES = {
    "water": (
        "{name} is nearby. If you can see the water, follow a ripple with your eyes until it disappears. There’s no hurry.",
        "A little moment for {name}: if the water is in view, look for a reflection you might have walked straight past.",
        "Near {name}, try a few steps without checking your phone. What can you hear when you give it your attention?",
        "Still close to {name}. If there’s a safe place to stop, give yourself a minute with nothing to do and nowhere else to be.",
        "With {name} nearby, here’s a small scavenger hunt: can you spot something moving and something completely still?",
        "A different way to notice {name}: if it’s in view, look for the smallest detail rather than the whole scene.",
    ),
    "park": (
        "{name} is nearby. Pick out one detail you’d normally pass without noticing—a shape, a color, a patch of light.",
        "A small challenge near {name}: find three different shades of green, if there are any in view. No need to rush.",
        "Near {name}, give your ears a turn. What’s the quietest sound you can pick out?",
        "{name} is part of this stretch. If a good place to pause catches your eye, you’re allowed to linger.",
        "A little postcard from near {name}: what’s the one detail you’d tell someone about later?",
        "Passing near {name} again? Try looking at this stretch as if it were your first visit. What stands out?",
    ),
    "trees": (
        "{name} is nearby. If trees are in view, pick one and look at the outline of its branches rather than the whole canopy.",
        "Near {name}, look for a pattern you hadn’t noticed. Leaves, bark, shadows—whatever is actually around you.",
        "A moment near {name}: if you hear leaves moving, give that sound your attention for a few steps.",
        "With {name} nearby, let your eyes wander away from the path for a moment when it’s safe. What draws them first?",
        "Near {name}, try noticing the gaps between the branches, if you can see them. A different view of the same place.",
        "No photo needed near {name}. Just choose one detail you’d like to remember from this walk.",
    ),
    "viewpoint": (
        "{name} is nearby. If you have a view, let your eyes travel from the nearest detail to the farthest one.",
        "A moment for {name}: if the view opens up here, what catches your eye first?",
        "Near {name}, see if you can find a comfortable, safe place to pause. The next part of the walk can wait a minute.",
        "{name} is nearby. If it’s in view, pick out one detail you’d miss in a photograph.",
        "Close to {name}, try noticing the edges of the scene rather than its center. Anything unexpected?",
        "Another moment near {name}. If you stop, let yourself enjoy it without needing to capture it.",
    ),
}

OPEN_MESSAGES = (
    "Try a few steps without looking at your phone. What’s the first small detail that catches your eye here?",
    "Let your ears lead for a moment. Can you pick out a quiet sound underneath the louder ones?",
    "A tiny scavenger hunt for this stretch: find a color you haven’t noticed yet on this walk.",
    "Nothing to tick off here. If a safe spot to pause catches your eye, take a moment just for yourself.",
    "What would you show a friend about this little stretch? Look for something you’d normally walk straight past.",
    "Let this bit of the walk be unhurried. Choose one detail to remember, without taking a picture.",
)


def compose_context(landmarks, progress_meters):
    block = int(progress_meters // 150)
    if not landmarks:
        return OPEN_MESSAGES[block % len(OPEN_MESSAGES)], []

    # Alternate only between genuinely close candidates; never keep referring
    # to a previous place after it falls outside the current lookup.
    closest = landmarks[0]["distance_meters"]
    candidates = [item for item in landmarks if item["distance_meters"] <= closest + 60]
    focus = candidates[(block // 2) % len(candidates)]
    templates = MESSAGES.get(focus["kind"], OPEN_MESSAGES)
    message = templates[block % len(templates)].format(name=focus["name"])
    ordered = [focus] + [item for item in landmarks if item is not focus]
    return message, ordered
