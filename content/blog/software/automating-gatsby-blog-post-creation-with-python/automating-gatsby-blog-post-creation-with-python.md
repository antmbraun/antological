---
title: "Automating Gatsby blog post creation with Python"
date: "2024-04-26"
description: "Use this script for effortless Gatsby blog post creation"
tags: ['software engineering']
featuredImage: "gatsby"
---

I just started this blog and because I suffer from the typical developer affliction of constantly starting projects and then forgetting about them, I decided to enlist the help of ChatGPT to make creating new posts as frictionless as possible.

Together "we" created this script that automates new post creation for a Gatsby blog.

```Python
import os
import datetime

def find_content_dir():
    current_dir = os.getcwd()
    while current_dir != "/":
        if os.path.isdir(os.path.join(current_dir, "content", "blog")):
            return os.path.join(current_dir, "content", "blog")
        current_dir = os.path.dirname(current_dir)
    print("Error: 'content/blog' directory not found.")
    exit(1)

def get_user_input(prompt, required=True):
    while True:
        user_input = input(prompt)
        if not user_input and required:
            print("This field cannot be empty. Please enter a value.")
        else:
            return user_input

def collect_tags(content_dir):
    tag_map = {}
    tag_index = 1
    for root, dirs, files in os.walk(content_dir):
        for file in files:
            if file.endswith(".md"):
                try:
                    with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                        content = f.readlines()
                except IOError as e:
                    print(f"Warning: Failed to read file {file}: {e}")
                    continue
                tags_line = next((line for line in content if line.startswith('tags:')), None)
                if tags_line:
                    tags_line = tags_line.strip().replace('tags: [', '').replace(']', '').replace('"', '').replace("'", '')
                    tags = tags_line.split(', ')
                    for tag in tags:
                        tag = tag.strip().lower()  # Normalize tag casing
                        if tag and tag not in tag_map:
                            tag_map[tag] = tag_index
                            tag_index += 1
    return tag_map

def list_categories(content_dir):
    categories = [d for d in os.listdir(content_dir) if os.path.isdir(os.path.join(content_dir, d))]
    return categories

def main():
    content_dir = find_content_dir()

    categories = list_categories(content_dir)
    print("Available categories:")
    for index, category in enumerate(categories, 1):
        print(f"{index}: {category}")
    category_choice = get_user_input("Enter the number of the category or type a new category name: ")

    if category_choice.isdigit() and int(category_choice) - 1 < len(categories):
        category_name = categories[int(category_choice) - 1]
    else:
        category_name = category_choice.lower().replace(' ', '-')
        os.makedirs(os.path.join(content_dir, category_name), exist_ok=True)

    post_title = get_user_input("Enter post title: ")
    post_date = get_user_input("Enter post date (YYYY-MM-DD), or press enter for today's date: ", required=False)
    if not post_date:
        post_date = datetime.datetime.now().strftime("%Y-%m-%d")
    meta_description = get_user_input("Enter meta description: ")
    tag_map = collect_tags(content_dir)

    selected_tags = []
    print("Select tags by entering the corresponding number. Enter a new tag by typing it. Hit enter when finished.")
    for tag, number in tag_map.items():
        print(f"{number}: {tag}")

    while True:
        input_tag = get_user_input("Enter tag (or hit Enter to finish): ", required=False)
        if not input_tag:
            break
        elif input_tag.isdigit() and int(input_tag) in tag_map.values():
            tag_found = next((tag for tag, number in tag_map.items() if number == int(input_tag)), None)
            selected_tags.append(tag_found)
            print(f"Added: {tag_found}")
        else:
            normalized_tag = input_tag.lower()
            selected_tags.append(normalized_tag)
            print(f"Added new tag: {normalized_tag}")

    meta_image_file_name = get_user_input("Enter meta image file name: ")

    folder_name = post_title.lower().replace(' ', '-')
    full_path = os.path.join(content_dir, category_name, folder_name)
    os.makedirs(full_path, exist_ok=True)
    md_file_path = os.path.join(full_path, f"{folder_name}.md")

    tags_string = ', '.join(f"'{tag}'" for tag in selected_tags)
    with open(md_file_path, 'w', encoding='utf-8') as f:
        f.write(f"""---
title: "{post_title}"
date: "{post_date}"
description: "{meta_description}"
tags: [{tags_string}]
featuredImage: "{meta_image_file_name}"
---
""")
    print(f"Post created in {md_file_path}")

if __name__ == "__main__":
    main()
```

Hopefully someone finds it useful.

Other things I want to automate for this blog:
- Meta description, meta image, and post title creation using generative AI
- Crossposting to Reddit and X
