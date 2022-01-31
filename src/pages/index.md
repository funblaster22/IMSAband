---
title: Navigation
description: All pages, arranged alphabetically
layout: layouts/posts.njk
---

{% for post in collections.pages | reverse %}
    {% if post.url != page.url %}
        {% card post.data.page.filePathStem %}
    {% endif %}
{% endfor %}