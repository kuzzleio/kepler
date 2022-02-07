# Kepler

## Installation

Kepler is Kuzzle application and should be installed and deployed as described in [the Documentation](https://docs.kuzzle.io/core/2/guides/getting-started/deploy-your-application/).

## Usage

It expose an HTTP POST route `/_/analytics/track` to track events it takes the following parameters:
- `a`: the user action name (required)
- `p`: the product name (required)
- `u`: the user identifier (required)
- `v`: the product version (required)

You can optionally provide `tags` in the request body.

## Example

```
curl -X POST -H "Content-Type: application/json" -d '{
  "a": "product_view",
  "p": "my_product",
  "u": "user_id",
  "v": "1.0.0",
  "tags": {
    "my_tag": "my_value",
    "my_other_tag": "my_other_value"
  }
}' http://localhost:7512/_/analytics/track
```
