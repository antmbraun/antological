/**
 * SEO component that queries for data with
 * Gatsby's useStaticQuery React hook
 *
 * See: https://www.gatsbyjs.com/docs/how-to/querying-data/use-static-query/
 */

import * as React from "react"
import { useStaticQuery, graphql } from "gatsby"

const Seo = ({ description, featuredImage, url, title, children }) => {
  const { site, ogImageDefault } = useStaticQuery(
    graphql`
      query {
        site {
          siteMetadata {
            title
            description
            social {
              twitter
            }
            siteUrl
          }
        }

        ogImageDefault: file(relativePath: { eq: "antological_meta.jpeg" }) {
          childImageSharp {
            gatsbyImageData(layout: FIXED, height: 630, width: 1200)
          }
        }
      }
    `
  )

  const metaDescription = description || site.siteMetadata.description
  const defaultTitle = site.siteMetadata?.title
  const defaultImgUrl = ogImageDefault.childImageSharp.gatsbyImageData.images.fallback.src

  const imagePath = constructUrl(
    site.siteMetadata.siteUrl, 
    featuredImage ?? defaultImgUrl
  )

  return (
    <>
      <title>{defaultTitle ? `${title} | ${defaultTitle}` : title}</title>
      <meta name="description" content={metaDescription} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={imagePath} />
      <meta property="og:url" content={constructUrl(site.siteMetadata.siteUrl, url)} />
      <meta name="twitter:card" content="summary" />
      <meta
        name="twitter:creator"
        content={site.siteMetadata?.social?.twitter || ``}
      />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={imagePath} />
      {children}
    </>
  )

  function constructUrl(baseUrl, path) {
    if (baseUrl === "" || path === "") return "";
    return `${baseUrl}${path}`;
  }
}

export default Seo
