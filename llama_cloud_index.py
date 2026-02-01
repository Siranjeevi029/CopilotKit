# pip install llama-cloud>=1.0
from llama_cloud import LlamaCloud, AsyncLlamaCloud
import os 
from dotenv import load_dotenv
load_dotenv()

client = LlamaCloud(api_key=os.getenv("LLAMA_CLOUD_API_KEY"))

# Retrieve relevant nodes from the index
results = client.pipelines.retrieve(
  pipeline_id="4aeca46b-149b-4c66-9e56-aab7c3485a34",
  query="can u give me something about the rag fusion from the doc",
  # -- Customize search behavior --
  # dense_similarity_top_k=20,
  # sparse_similarity_top_k=20,
  # alpha=0.5,
  # -- Control reranking behavior --
  # enable_reranking=True,
  # rerank_top_n=5,
)

for n in results.retrieval_nodes:
  print(f"Score: {n.score}, Text: {n.node.text}")