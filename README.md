# IMSA Music

**[Live site: https://funblaster22.github.io/IMSAband/](https://funblaster22.github.io/IMSAband/)**

Welcome to the IMSA music website! This project is licensed under GPL-3, so you are free to modify and distribute it
as long as you include the license and source code.

### Project structure

← `public/index.css`: The styling rules for your pages and posts.

← `src/`: This folder contains all the files Eleventy will use to build your site.

← `src/index.md`, `src/posts.md`, `src/about.md`: These Markdown files are the content for your Home, Posts, and About pages.

← `src/posts/`: These are the Markdown files for the posts that make up your blog.

← `src/seo.json`: When you're ready to share your new site or add a custom domain, change SEO/meta settings in here.

← `src/_includes`: This is where all of your page level layouts go. The **\_** tells you that this is an _eleventy only_ folder.


### Overview of technologies
- [11ty](https://www.11ty.dev/), a static site generator
- [Nunjucks](https://mozilla.github.io/nunjucks/templating.html) (*.njk), a templating language
- [Bootstrap](https://getbootstrap.com/docs/), a UI component library
- [Markdown](https://www.markdownguide.org/basic-syntax/) (*.md), an easily readable markup language

I decided against Jekyl because it is written in Ruby, which I am unfamiliar with.
I also figured it would be easier to incorporate extra frameworks with 11ty since it uses javascript.