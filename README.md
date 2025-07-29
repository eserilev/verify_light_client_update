## Example usage

Fetch light client data
```
curl '{beacon_api_url}/eth/v1/beacon/light_client/updates?start_period=110&count=1' -H 'Accept: application/octet-stream'" > ./light_client_update.ssz
```

Run the program to verify that the light client update is legit

```
node chainsafe_ssz_decoder.js light_client_update.ssz
```

Included in the repo are two light client updates, one using a public lodestar beacon API, and another using a private lighthouse beacon API with fixes from this PR
https://github.com/sigp/lighthouse/pull/7806
