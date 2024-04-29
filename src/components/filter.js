import React from 'react';

// Import necessary dependencies

// Define the Filter component
const Filter = ({ posts, onTagSelect, selectedTag }) => {
  // Handle the change event of the dropdown
  const handleTagChange = (event) => {
    onTagSelect(event.target.value);
  };

  const tags = [...new Set(posts.reduce((allTags, post) => {
    if (post.frontmatter.tags) {
      return [...allTags, ...post.frontmatter.tags];
    } else {
      return allTags;
    }
  }, []))];

  // Render the Filter component
  return (
    <select value={selectedTag} onChange={handleTagChange}>
      <option value="">select a category</option>
      {tags.map((tag, index) => (
        <option key={index} value={tag}>
          {tag}
        </option>
      ))}
    </select>
  );
};

export default Filter;