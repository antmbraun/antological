import React, { useState, useEffect } from 'react';
import { Link, graphql, navigate } from "gatsby"

import Bio from "../components/bio"
import Layout from "../components/layout"
import Seo from "../components/seo"
import Filter from "../components/filter"

const BlogIndex = ({ data, location }) => {
  const siteTitle = data.site.siteMetadata?.title || `Title`
  const posts = data.allMarkdownRemark.nodes

  // Get the initial tag from URL search parameters and replace hyphens with spaces
  const initialTag = new URLSearchParams(location.search).get('tag')?.replace(/-/g, ' ') || '';

  const [selectedTag, setSelectedTag] = useState(initialTag);

  useEffect(() => {
    // When selectedTag changes, update the URL by replacing spaces with hyphens
    const tagForURL = selectedTag.replace(/\s+/g, '-');
    if (selectedTag) {
      navigate(`?tag=${tagForURL}`, { replace: true });
    } else {
      navigate(`/`, { replace: true });
    }
  }, [selectedTag]);

  // Filter posts based on the selectedTag which has spaces decoded from the URL
  const filteredPosts = selectedTag 
    ? posts.filter(post => post.frontmatter.tags ? post.frontmatter.tags.includes(selectedTag) : false)
    : posts;

  if (filteredPosts.length === 0) {
    return (
      <Layout location={location} title={siteTitle}>
        <Bio />
        <p>
          No posts found. Try selecting a different tag.
        </p>
      </Layout>
    );
  }

  return (
    <Layout location={location} title={siteTitle}>
      <Bio />
      <Filter posts={posts} onTagSelect={setSelectedTag} selectedTag={selectedTag} />
      <ol style={{ listStyle: `none` }}>
        {filteredPosts.map(post => {
          const title = post.frontmatter.title || post.fields.slug

          return (
            <li key={post.fields.slug}>
              <article
                className="post-list-item"
                itemScope
                itemType="http://schema.org/Article"
              >
                <header>
                  <h2>
                    <Link to={post.fields.slug} itemProp="url">
                      <span itemProp="headline">{title}</span>
                    </Link>
                  </h2>
                  <small>{post.frontmatter.date}</small>
                </header>
                <section>
                  <p
                    dangerouslySetInnerHTML={{
                      __html: post.frontmatter.description || post.excerpt,
                    }}
                    itemProp="description"
                  />
                </section>
              </article>
            </li>
          )
        })}
      </ol>
    </Layout>
  )
}

export default BlogIndex

export const Head = () => <Seo title="All posts" />

export const pageQuery = graphql`
  {
    site {
      siteMetadata {
        title
      }
    }
    allMarkdownRemark(sort: { frontmatter: { date: DESC } }) {
      nodes {
        excerpt
        fields {
          slug
        }
        frontmatter {
          date(formatString: "MMMM DD, YYYY")
          title
          description
          tags
        }
      }
    }
  }
`
