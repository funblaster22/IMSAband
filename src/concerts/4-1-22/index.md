---
title: Pop Concert
date: 2022-04-01
tags:
    - Wind Ensemble
    - Concert Band
video: https://www.youtube.com/embed/dQw4w9WgXcQ
---

Get hyped for our upcoming concert! Ideally, there would be a short description here. Maybe a pdf copy of the program?

{{tags | dump}}
{% for page in collections.all | includesAllTags("Pep Band", "concerts") %}
{{page.data.title}}
{% endfor %}

<!-- TODO: Generate with template -->
<!--script>has the concert passed or is upcoming?</script-->
Images coming soon! || images