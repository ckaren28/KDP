/**
 * Rehype plugin: groups consecutive <p><img></p> siblings into
 * <div class="image-grid"> wrappers. Runs of 1 are left untouched.
 * Whitespace-only text nodes between img-paragraphs are absorbed into the group.
 */

function isImgParagraph(node) {
  if (node.type !== 'element' || node.tagName !== 'p') return false;
  const meaningful = (node.children ?? []).filter(
    c => !(c.type === 'text' && !c.value.trim())
  );
  return (
    meaningful.length > 0 &&
    meaningful.every(c => c.type === 'element' && c.tagName === 'img')
  );
}

function isWhitespace(node) {
  return node.type === 'text' && !node.value.trim();
}

function processChildren(children) {
  const out = [];
  let i = 0;
  while (i < children.length) {
    if (isImgParagraph(children[i])) {
      // Collect a run of img-paragraphs, skipping whitespace text nodes between them.
      const imgs = [];
      const runNodes = []; // original nodes consumed (to restore if run is only 1)

      while (i < children.length) {
        if (isImgParagraph(children[i])) {
          imgs.push(
            ...children[i].children.filter(
              c => c.type === 'element' && c.tagName === 'img'
            )
          );
          runNodes.push(children[i]);
          i++;
        } else if (isWhitespace(children[i])) {
          // Peek ahead past whitespace to see if another img-paragraph follows
          let j = i + 1;
          while (j < children.length && isWhitespace(children[j])) j++;
          if (j < children.length && isImgParagraph(children[j])) {
            runNodes.push(children[i]); // absorb the whitespace into the run
            i++;
          } else {
            break; // whitespace leads to a non-img node — end the run
          }
        } else {
          break;
        }
      }

      if (imgs.length >= 2) {
        out.push({
          type: 'element',
          tagName: 'div',
          properties: { className: ['image-grid'] },
          children: imgs,
        });
      } else {
        // Single img-paragraph: push original nodes unchanged
        out.push(...runNodes);
      }
    } else {
      out.push(children[i++]);
    }
  }
  return out;
}

function walk(node) {
  if (!node.children?.length) return;
  node.children = processChildren(node.children);
  node.children.forEach(walk);
}

export default function rehypeImageGrid() {
  return walk;
}
