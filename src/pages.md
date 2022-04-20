---
title: Navigation
description: All pages, arranged alphabetically
eleventyExcludeFromCollections: true
layout: layouts/posts.njk
collection: navigation
---

TODO: I wish I could do this, but 11ty navigation does not store src file location, which is needed :/
{% for post in collections.all | eleventyNavigation %}
{% endfor %}
